# Syria Silicon Website — Deployment Guide

This is the complete step-by-step for getting syriasilicon.com live on Vercel, with a Supabase backend in Frankfurt and Resend sending email notifications to nawraselali@gmail.com.

Read it through once first. Then work through it in order. Total time about 60 minutes.

---

## Architecture summary

```
   Visitor browser
        │
        │  (form submit, JSON POST)
        ▼
   ┌─────────────┐
   │  Supabase   │  ───────►  Insert row into 'enquiries' table
   │  Frankfurt  │              │
   └─────────────┘              ▼
                            Trigger fires
                                │
                                ▼
                       ┌────────────────┐
                       │     Resend     │  ─────►  Send email
                       │  (email API)   │            from notifications@syriasilicon.com
                       └────────────────┘            to nawraselali@gmail.com
                                                     reply-to: visitor's email
```

The website itself is plain static HTML/CSS/JS served by Vercel's global CDN.

---

## Step 0 — Fix the broken DNS first (3 minutes)

**This is the most urgent thing. The site cannot work reliably until you do this.**

Right now your Hostinger DNS has two conflicting A records on the apex domain:

| Type | Name | Content | Action |
|---|---|---|---|
| A | @ | `2.57.91.91` | **DELETE THIS** |
| A | @ | `76.76.21.21` | Keep this (it's Vercel) |

In hPanel → Domains → syriasilicon.com → DNS / Nameservers, find the row with `2.57.91.91` and click the red **Delete** button on the right. Confirm.

Do not touch anything else: leave the MX records, the hostingermail-* DKIM records, the SPF record, the DMARC record, the autodiscover and autoconfig CNAMEs, and the www CNAME alone. They are all correct.

---

## Step 1 — Sign up for Resend (10 minutes)

Resend will send the email notifications.

### 1a. Create your Resend account

1. Go to **https://resend.com/signup**
2. Sign up with email or GitHub
3. Pick the **free tier** (100 emails/day, 3,000/month — plenty for a contact form)

### 1b. Add and verify the syriasilicon.com domain

1. In Resend, sidebar: **Domains** → **Add Domain**
2. Domain name: `syriasilicon.com`
3. Region: **EU (Frankfurt)** to match Supabase
4. Click **Add**

Resend will show you DNS records to add. There will be three to four records: a TXT record (SPF), three CNAME records (DKIM), and optionally a TXT record (DMARC, if you want).

### 1c. Add Resend's DNS records in Hostinger

This is the careful part. Open Hostinger DNS in a separate tab so you have both Resend and Hostinger visible.

**DKIM CNAME records (3 records):**

Resend will show you something like:
- `resend._domainkey.syriasilicon.com` → `resend._domainkey.amazonses.com`
- (Or similar, the exact values come from Resend)

For each DKIM CNAME, in Hostinger:
1. Click **Add new record**
2. Type: `CNAME`
3. Name: copy the name from Resend, but **remove `.syriasilicon.com`** at the end (Hostinger adds the domain automatically). So if Resend says `resend._domainkey.syriasilicon.com`, you type just `resend._domainkey`
4. Points to: paste the value from Resend exactly
5. TTL: leave default
6. Save

**SPF record (the tricky one):**

You already have an SPF record: `v=spf1 include:_spf.mailhostinger.com -all`

Resend wants you to add `include:amazonses.com` (or similar Resend SPF). You **cannot** have two SPF records on the same domain — that breaks SPF entirely. You need to **edit the existing one** to include both.

In Hostinger, find the TXT record with name `@` and content `"v=spf1 include:_spf.mailhostinger.com -all"`. Click **Edit**. Change the content to:

```
v=spf1 include:_spf.mailhostinger.com include:amazonses.com -all
```

(Replace `amazonses.com` with whatever Resend actually instructs, if different. Most likely it is `amazonses.com` because Resend runs on AWS SES infrastructure.)

Save the change.

**Important:** Hostinger may show the SPF record wrapped in quotes (`"v=spf1 ..."`). When editing, don't add extra quotes; the system handles them.

### 1d. Verify in Resend

Back in Resend, click **Verify DNS Records**. The first time you'll see "Pending" — DNS propagation takes 5 to 30 minutes typically. Refresh every few minutes until each record shows a green check.

If after 1 hour any record is still pending, double-check the value in Hostinger matches what Resend showed exactly (a single missing character will fail verification).

### 1e. Create the Resend API key

Once the domain shows verified:

1. Resend sidebar: **API Keys** → **Create API Key**
2. Name: `Syria Silicon Website`
3. Permission: **Full access** (this is fine for a single-purpose key)
4. Click **Add**
5. **Copy the key immediately** — Resend will only show it once. Paste it into a temporary note. It starts with `re_` and is about 30 characters long.

You'll paste this into Supabase in Step 2.

---

## Step 2 — Configure Supabase (15 minutes)

You said you've already created the Supabase project in your nawras organisation. Good. Make sure it's in the **eu-central-1 (Frankfurt)** region. If you accidentally picked another region, the easiest fix is to delete that project and create a new one in Frankfurt (data migration on Supabase is harder than just re-running our one SQL script).

### 2a. Run the setup SQL

1. In your Supabase project, sidebar: **SQL Editor** → **New query**
2. Open `SETUP.sql` from this repo
3. **Before pasting**, find this line near line 32:
   ```sql
   're_YOUR_RESEND_API_KEY_HERE',
   ```
   Replace `re_YOUR_RESEND_API_KEY_HERE` with your actual Resend API key from Step 1e. Keep the single quotes.
4. Now copy the entire (modified) SQL file
5. Paste it into the SQL Editor
6. Click **Run**

You should see "Success. No rows returned" (or similar). This creates the table, security policies, vault entry, and email trigger.

### 2b. Get your Supabase project URL and anon key

1. Supabase sidebar: gear icon at the bottom → **Project Settings** → **API**
2. Copy two values:
   - **Project URL** (something like `https://abcdefghij.supabase.co`)
   - **Project API keys → anon / public** (a long string starting with `eyJ...`)

You'll paste these into the website code in Step 3.

### 2c. Optional but recommended: store the Resend key as an env variable too

In Supabase **Project Settings → Edge Functions → Secrets**, you can also add `RESEND_API_KEY` as a secret. We don't need it for the trigger we've set up (which uses Vault), but if you ever migrate to using an Edge Function instead of a database trigger, having it there saves a step.

---

## Step 3 — Wire up the website code (5 minutes)

Open `script.js` in this repo. At the top, find:

```javascript
const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-PUBLIC-ANON-KEY';
```

Replace both values with what you copied in Step 2b. Save the file.

These keys are safe in public code. The "anon" key only has permission to insert into the enquiries table (it cannot read, edit, or delete anything). The real protection is the Row Level Security policy we set up in SETUP.sql.

---

## Step 4 — Push to GitHub (5 minutes)

### 4a. Create the repo

1. Go to **https://github.com/new**
2. Repository name: `syriasilicon-com`
3. Visibility: **Private**
4. Don't initialise with README, gitignore, or licence (we already have these)
5. Click **Create repository**

GitHub will show you a "quick setup" page with commands. Ignore them. Use the web interface instead.

### 4b. Upload the files

On the empty repo page, click the **uploading an existing file** link. Drag all of these from this repo folder into the upload area:

- `index.html`
- `styles.css`
- `script.js` (with your real Supabase keys pasted in)
- `vercel.json`
- `README.md`
- `DEPLOYMENT.md`
- `SETUP.sql` (with your real Resend key pasted in — or remove that line, your call)
- `.gitignore`
- the entire `images` folder

In the commit message field at the bottom, type `Initial commit of syriasilicon.com`. Click **Commit changes**.

**One caveat about `SETUP.sql`:** It contains a placeholder for your Resend API key. If you replaced the placeholder with your real key before pushing, that real key is now in the repo. Since the repo is private and only you can access it, this is acceptable but not ideal. The cleaner approach is to either:

- Leave the placeholder in the committed file, and keep your real key only in a private note (you've already used the key once when you ran the SQL, you don't need it in the repo)
- Or **remove `SETUP.sql` entirely from the repo** after you've successfully run it once. The whole point of that file is to set up Supabase, and Supabase remembers the configuration.

I recommend the second option: once Supabase is set up and working, delete `SETUP.sql` from the repo.

---

## Step 5 — Deploy to Vercel (5 minutes)

### 5a. Sign up and import

1. Go to **https://vercel.com/signup**
2. Sign up with **GitHub** (this is the key — it gives Vercel access to your repos)
3. After signup, Vercel asks which repos you want to give it access to. Choose either:
   - **All repositories** (simplest, fine for now)
   - **Selected repositories** → pick `syriasilicon-com`

### 5b. Import the project

1. Vercel dashboard → **Add New** → **Project**
2. You'll see `syriasilicon-com` in the list. Click **Import**
3. On the configure screen:
   - **Framework Preset**: Other
   - **Build & Output settings**: leave all defaults (no build command, no output directory)
   - **Environment Variables**: none needed
4. Click **Deploy**

In about 30 seconds, Vercel shows you a working URL like `https://syriasilicon-com-abc123.vercel.app`. Open it.

### 5c. Test the contact form

1. Scroll to the contact section on the live Vercel preview URL
2. Fill in your name, your email, a message
3. Click **Send message**
4. You should see: "Message sent" with a green tick

Then check three places:

- **Supabase** → Table Editor → enquiries: your row should be there
- **Resend** → Logs: a sent email entry
- **Gmail (nawraselali@gmail.com)**: the notification email, formatted nicely, with the visitor's email in the From line so you can hit Reply directly

If any of these is missing, see Troubleshooting at the bottom.

---

## Step 6 — Point syriasilicon.com to Vercel (5 minutes + propagation time)

### 6a. Add the custom domain in Vercel

1. In Vercel, your `syriasilicon-com` project → **Settings** → **Domains**
2. Type `syriasilicon.com` and click **Add**
3. Add `www.syriasilicon.com` as well — Vercel will automatically configure one to redirect to the other

### 6b. Verify DNS is correct

You already did the DNS work earlier. Vercel will check both records:

- `A @ 76.76.21.21` — should be configured ✓
- `CNAME www cname.vercel-dns.com` — should be configured ✓

If you completed Step 0 (deleted the stale `2.57.91.91` A record), Vercel should show **Valid Configuration** within a few minutes.

If Vercel still says "Invalid Configuration":
- Check Hostinger DNS one more time — make sure only one A record exists for `@`
- DNS changes can take up to 24 hours globally. Usually it's under 1 hour
- Use https://dnschecker.org/?type=A&query=syriasilicon.com to see global propagation

### 6c. HTTPS is automatic

Once Vercel sees the DNS is correct, it automatically issues an SSL certificate via Let's Encrypt. This takes about a minute. After that, visit `https://syriasilicon.com` — the site is live.

---

## You're done. Site is live.

Every time you commit to the GitHub repo's `main` branch from now on, Vercel redeploys automatically. To edit content:

1. Go to `github.com/YOUR-USERNAME/syriasilicon-com`
2. Click on a file (e.g. `index.html`)
3. Click the pencil icon (top right)
4. Make changes, scroll down, click **Commit changes**
5. Wait 30 seconds — Vercel rebuilds and the site updates

---

## How to read enquiries

Every contact form submission lands in two places:

1. **Your Gmail (nawraselali@gmail.com)** — within seconds, you get a formatted email. Reply directly from Gmail; the reply goes to the visitor.
2. **Supabase Dashboard** → **Table Editor** → **enquiries** — every submission is stored permanently here. You can export to CSV if you ever need to.

The `email_sent` column shows whether the trigger fired Resend successfully (`true`). The `email_error` column shows any error from the trigger if email failed but the row still saved.

---

## Troubleshooting

### "Message sent" appears but no email arrives in Gmail

Three things to check, in order:

1. **Did the row save in Supabase?**
   - Supabase → Table Editor → enquiries
   - If the row is there, the website-to-database connection is fine
   - If the row is not there, the issue is in `script.js` (wrong Supabase URL or key)

2. **Did Resend record an attempt?**
   - Resend → Logs
   - If there's an entry, look at its status (Delivered, Bounced, etc.)
   - If there's no entry, the trigger isn't calling Resend. Check the `email_error` column in the enquiries row

3. **Is the email in Gmail spam?**
   - Check spam/promotions
   - First emails from a newly-verified domain occasionally get filtered
   - Mark "Not spam" and future emails will go to inbox

### "Message sent" never appears, button stays on "Sending..."

Open browser DevTools (F12) → Console tab. Submit again. You'll see an error message.

Common causes:
- Wrong Supabase URL or anon key in `script.js`
- Browser ad-blocker blocking Supabase API calls (try in incognito mode)
- CORS error — should not happen with default Supabase setup, but if it does, check Supabase → Authentication → URL Configuration

### The Resend email fails with "from address not verified"

Your Resend domain verification didn't complete, or you're using the wrong from address. Check that:
- Resend → Domains shows `syriasilicon.com` as **Verified** (green check)
- The from address in `SETUP.sql` is `notifications@syriasilicon.com` (it should be, by default)

### DNS still showing old hosting after 24 hours

This is unusual. Things to check:
- Is the stale A record (`2.57.91.91`) really deleted in Hostinger?
- Are there any other A records for `@` that you missed?
- Try flushing your local DNS cache: on Mac, `sudo dscacheutil -flushcache`; on Windows, `ipconfig /flushdns`

### Form submissions to test work but real emails don't seem to reach me

- Mark `notifications@syriasilicon.com` as a trusted contact in Gmail
- Add a Gmail filter: From `notifications@syriasilicon.com` → Never send to spam, Star, Mark as important

---

## What this costs

| Service | Plan | Cost |
|---|---|---|
| Hostinger | Domain registration | ~AUD 18/year (annual renewal) |
| Vercel | Hobby plan | Free |
| Supabase | Free plan | Free up to 50,000 monthly active users and 500MB database |
| Resend | Free plan | Free up to 3,000 emails/month |

Total annual cost for the website: about AUD 18.

You may want to upgrade Resend to a paid plan (USD $20/month) if you ever start sending bulk emails. For a contact form with maybe 20-50 enquiries a month, free is plenty.

---

## Security notes

The Supabase anon key in `script.js` is intentionally public. This is by design — anon keys are how Supabase identifies your project to the API. The protection comes from the Row Level Security policy in `SETUP.sql`, which says: anonymous users can ONLY insert into the enquiries table, never read, update, or delete.

The Resend API key is private and lives only in Supabase Vault (encrypted at rest). It is never sent to the browser.

The website itself is served over HTTPS by Vercel with automatic certificate renewal. Security headers (X-Content-Type-Options, Referrer-Policy, etc.) are set in `vercel.json`.

---

## Going forward

When you want to add things to the site:

- **Update content**: edit files on GitHub, commit, done
- **Add a new section**: edit `index.html` and `styles.css`, commit
- **Add new images**: drop into `images/` folder, reference in `index.html`
- **Change colour scheme**: edit the CSS variables at the top of `styles.css` (the `:root` block)
- **Add a data room behind login**: this is a bigger piece. Supabase Auth is built in. Ask me when you're ready.

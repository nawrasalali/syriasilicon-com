# syriasilicon.com 

The public website for Syria Silicon, a Syrian industrial silica sand project.

**Live:** https://syriasilicon.com
**Hosting:** Vercel (static)
**Backend:** Supabase (eu-central-1 / Frankfurt) for the contact form
**Email:** Resend (notifications to nawraselali@gmail.com)
**Domain:** Registered with Hostinger, DNS pointing to Vercel

## Structure

```
.
├── index.html       Single-page site
├── styles.css       Stylesheet
├── script.js        Interactivity + Supabase form submission
├── vercel.json      Vercel routing and headers
├── SETUP.sql        One-time database setup for Supabase
├── DEPLOYMENT.md    Full deployment guide
├── .gitignore       Files to keep out of the repo
└── images/          Three asset photographs (no people)
```

## Editing

To change site content, edit `index.html` directly. Every commit to `main` triggers an automatic redeploy on Vercel within 30 seconds.

For configuration changes (Supabase keys, Resend keys), see `DEPLOYMENT.md`.

## What this site deliberately does NOT contain

- Financial model, IRR, EBITDA, or equity split (these are in the prospectus under NDA)
- Names of the Saudi investor or any prospective buyer
- Images showing identifiable individuals
- Reference numbers or dates of official government correspondence
- Sanctions disclaimer (Syria is treated as a normal country)
- Analytics tracking, newsletter sign-up, or blog

This is a credibility site for serious counterparties, not a marketing funnel.

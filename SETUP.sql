-- ============================================================
-- Syria Silicon Website - Supabase Database Setup
-- Project: syriasilicon (region: eu-central-1 / Frankfurt)
-- Project ref: qzfrhxjcsnhaqhckfswi
--
-- This file is kept as a reference for the database setup that was
-- applied via Supabase migrations. You normally never need to re-run it.
-- If you ever need to rebuild the database from scratch, run the SQL
-- below in this order. Replace the placeholder for your Resend API key.
-- ============================================================

-- ============================================================
-- PART 1: Enable pg_net for HTTP calls from Postgres
-- ============================================================

create extension if not exists pg_net with schema extensions;

-- ============================================================
-- PART 2: The enquiries table
-- ============================================================

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now() not null,
  name text not null,
  organisation text,
  email text not null,
  interest text,
  message text not null,
  user_agent text
);

create index if not exists enquiries_created_at_idx
  on public.enquiries(created_at desc);

comment on table public.enquiries is
  'Contact form submissions from syriasilicon.com.
   Anonymous users can INSERT only via RLS policy.
   SELECT/UPDATE/DELETE require admin role (visible in Supabase dashboard).';

-- ============================================================
-- PART 3: Row Level Security
-- Public visitors can submit, but nobody can read/edit/delete
-- through the API. Only you (logged into Supabase dashboard) see data.
-- ============================================================

alter table public.enquiries enable row level security;

drop policy if exists "Anyone can submit an enquiry" on public.enquiries;

create policy "Anyone can submit an enquiry"
  on public.enquiries for insert
  to anon
  with check (
    char_length(name) between 1 and 200
    and char_length(email) between 3 and 200
    and char_length(message) between 1 and 5000
  );

-- ============================================================
-- PART 4: Store Resend API key in Vault (encrypted at rest)
-- IMPORTANT: replace placeholder with your real Resend API key
-- ============================================================

-- select vault.create_secret(
--   're_YOUR_RESEND_API_KEY_HERE',
--   'resend_api_key',
--   'Resend API key for sending contact form notifications'
-- );

-- ============================================================
-- PART 5: Notification function
-- Reads Resend key from Vault, calls Resend API on every new enquiry.
-- Errors visible in net._http_response and Resend dashboard logs.
-- ============================================================

create or replace function public.notify_new_enquiry()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $func$
declare
  resend_key text;
  request_id bigint;
  email_html text;
  email_subject text;
begin
  begin
    select decrypted_secret into resend_key
    from vault.decrypted_secrets
    where name = 'resend_api_key'
    limit 1;
  exception when others then
    resend_key := null;
  end;

  if resend_key is null then
    return new;
  end if;

  email_subject := 'New enquiry from ' ||
    coalesce(new.name, 'unknown') ||
    case when new.organisation is not null and new.organisation <> ''
         then ' (' || new.organisation || ')'
         else ''
    end;

  email_html := format(
    '<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;padding:32px 24px;">' ||
    '<div style="border-top:3px solid #A89569;padding-top:24px;">' ||
    '<h2 style="font-family:Georgia,serif;color:#0B2545;margin:0 0 24px 0;font-size:22px;">New enquiry from the Syria Silicon website</h2>' ||
    '<table style="width:100%%;border-collapse:collapse;margin-bottom:24px;">' ||
    '<tr><td style="padding:8px 0;color:#6B7280;font-size:13px;text-transform:uppercase;letter-spacing:0.1em;width:140px;vertical-align:top;">Name</td><td style="padding:8px 0;font-size:15px;">%s</td></tr>' ||
    '<tr><td style="padding:8px 0;color:#6B7280;font-size:13px;text-transform:uppercase;letter-spacing:0.1em;vertical-align:top;">Organisation</td><td style="padding:8px 0;font-size:15px;">%s</td></tr>' ||
    '<tr><td style="padding:8px 0;color:#6B7280;font-size:13px;text-transform:uppercase;letter-spacing:0.1em;vertical-align:top;">Email</td><td style="padding:8px 0;font-size:15px;"><a href="mailto:%s" style="color:#13315C;">%s</a></td></tr>' ||
    '<tr><td style="padding:8px 0;color:#6B7280;font-size:13px;text-transform:uppercase;letter-spacing:0.1em;vertical-align:top;">Interest</td><td style="padding:8px 0;font-size:15px;">%s</td></tr>' ||
    '</table>' ||
    '<div style="border-top:1px solid #E5DFD3;padding-top:20px;">' ||
    '<p style="color:#6B7280;font-size:13px;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 12px 0;">Message</p>' ||
    '<div style="font-size:15px;line-height:1.6;white-space:pre-wrap;">%s</div>' ||
    '</div>' ||
    '<p style="color:#9CA3AF;font-size:12px;margin-top:32px;border-top:1px solid #E5DFD3;padding-top:16px;">Submitted %s. Reply directly to this email to reach the sender.</p>' ||
    '</div></body></html>',
    coalesce(new.name, '(not provided)'),
    coalesce(nullif(new.organisation, ''), '(not provided)'),
    new.email, new.email,
    coalesce(nullif(new.interest, ''), '(not specified)'),
    new.message,
    to_char(new.created_at at time zone 'UTC', 'DD Mon YYYY HH24:MI "UTC"')
  );

  select net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || resend_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', 'Syria Silicon <notifications@syriasilicon.com>',
      'to', jsonb_build_array('nawraselali@gmail.com'),
      'reply_to', new.email,
      'subject', email_subject,
      'html', email_html
    )
  ) into request_id;

  return new;

exception when others then
  return new;
end;
$func$;

-- ============================================================
-- PART 6: The trigger
-- ============================================================

drop trigger if exists on_new_enquiry on public.enquiries;

create trigger on_new_enquiry
  after insert on public.enquiries
  for each row
  execute function public.notify_new_enquiry();

-- Security: lock down direct REST API access to the function
revoke execute on function public.notify_new_enquiry() from anon, authenticated, public;

-- ============================================================
-- DONE.
-- To inspect email send status, query the pg_net response log:
--   select * from net._http_response order by created desc limit 20;
-- ============================================================

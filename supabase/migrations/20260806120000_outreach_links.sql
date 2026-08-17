create table if not exists public.outreach_links (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  lead_name text,
  lead_email text,
  video_url text,
  created_at timestamptz not null default now()
);

ALTER TABLE public.outreach_links
ADD COLUMN IF NOT EXISTS company_name text,
ADD COLUMN IF NOT EXISTS industry text,
ADD COLUMN IF NOT EXISTS company_summary text,
ADD COLUMN IF NOT EXISTS what_they_do text,
ADD COLUMN IF NOT EXISTS business_need text,
ADD COLUMN IF NOT EXISTS personalization_angle text,
ADD COLUMN IF NOT EXISTS headline text,
ADD COLUMN IF NOT EXISTS focus_area text,
ADD COLUMN IF NOT EXISTS intro_text text,
ADD COLUMN IF NOT EXISTS benefit_1 text,
ADD COLUMN IF NOT EXISTS benefit_2 text,
ADD COLUMN IF NOT EXISTS benefit_3 text,
ADD COLUMN IF NOT EXISTS video_intro text,
ADD COLUMN IF NOT EXISTS cta_text text,
ADD COLUMN IF NOT EXISTS closing_text text;

CREATE INDEX IF NOT EXISTS outreach_links_token_idx
ON public.outreach_links (token);
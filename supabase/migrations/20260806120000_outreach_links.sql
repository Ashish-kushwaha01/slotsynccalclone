-- create table if not exists public.outreach_links (
--   id uuid primary key default gen_random_uuid(),
--   token text unique not null,
--   username text not null,
--   slug text not null,
--   lead_name text,
--   lead_email text,
--   company text,
--   role text,
--   headline text,
--   note text,
--   video_url text,
--   cta text,
--   mode text default 'learn',
--   created_at timestamptz not null default now(),
--   expires_at timestamptz,
--   view_count integer default 0
-- );

-- create index if not exists outreach_links_token_idx on public.outreach_links (token);



create table if not exists public.outreach_links (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  lead_name text,
  lead_email text,
  video_url text,
  created_at timestamptz not null default now()
);
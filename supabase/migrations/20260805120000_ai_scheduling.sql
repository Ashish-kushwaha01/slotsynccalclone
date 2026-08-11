-- =============== AI EMAIL THREADS ===============
create table if not exists public.email_threads (
  id uuid primary key default gen_random_uuid(),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  event_type_id uuid not null references public.event_types(id) on delete cascade,
  thread_key text not null unique,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inbound_emails (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.email_threads(id) on delete cascade,
  message_id text not null unique,
  from_email text not null,
  to_email text not null,
  subject text,
  body_text text,
  raw_payload jsonb,
  received_at timestamptz not null default now()
);

create table if not exists public.ai_decisions (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.email_threads(id) on delete cascade,
  message_id text,
  model text not null,
  prompt_version text not null,
  response_json jsonb not null,
  intent text,
  confidence numeric(4,3),
  decision_status text not null default 'pending' check (decision_status in ('pending','booked','clarification','landing','error','ignored')),
  error_text text,
  created_at timestamptz not null default now()
);

-- =============== MEETING LINKS ===============
create table if not exists public.meeting_links (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  provider text not null,
  url text not null,
  created_at timestamptz not null default now()
);

-- =============== REMINDER JOBS ===============
create table if not exists public.reminder_jobs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  send_at timestamptz not null,
  template text not null,
  status text not null default 'pending' check (status in ('pending','sent','cancelled','failed')),
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists reminder_jobs_status_send_at_idx on public.reminder_jobs (status, send_at);

-- =============== BOOKING TOKENS ===============
create table if not exists public.reschedule_tokens (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  expires_at timestamptz,
  consumed_at timestamptz
);

create table if not exists public.cancel_tokens (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz,
  consumed_at timestamptz
);

-- =============== AI LANDING PAGES ===============
create table if not exists public.ai_landing_pages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.email_threads(id) on delete cascade,
  event_type_id uuid not null references public.event_types(id) on delete cascade,
  token text not null unique,
  invitee_email text not null,
  invitee_name text not null,
  intro_message text,
  video_url text,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

-- =============== AUDIT LOGS ===============
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- =============== IDEMPOTENCY KEYS ===============
create table if not exists public.request_idempotency (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  route text not null,
  request_hash text not null,
  response_json jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

-- RLS + grants (server-only)
grant all on public.email_threads to service_role;
grant all on public.inbound_emails to service_role;
grant all on public.ai_decisions to service_role;
grant all on public.meeting_links to service_role;
grant all on public.reminder_jobs to service_role;
grant all on public.reschedule_tokens to service_role;
grant all on public.cancel_tokens to service_role;
grant all on public.ai_landing_pages to service_role;
grant all on public.audit_logs to service_role;
grant all on public.request_idempotency to service_role;

alter table public.email_threads enable row level security;
alter table public.inbound_emails enable row level security;
alter table public.ai_decisions enable row level security;
alter table public.meeting_links enable row level security;
alter table public.reminder_jobs enable row level security;
alter table public.reschedule_tokens enable row level security;
alter table public.cancel_tokens enable row level security;
alter table public.ai_landing_pages enable row level security;
alter table public.audit_logs enable row level security;
alter table public.request_idempotency enable row level security;

-- Updated_at trigger for email_threads
create trigger trg_email_threads_updated_at
  before update on public.email_threads
  for each row execute function public.set_updated_at();

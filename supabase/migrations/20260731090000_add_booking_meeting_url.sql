alter table public.bookings
  add column if not exists meeting_url text;

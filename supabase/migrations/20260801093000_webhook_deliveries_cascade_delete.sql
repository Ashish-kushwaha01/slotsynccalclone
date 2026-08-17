alter table public.webhook_deliveries
  drop constraint if exists webhook_deliveries_booking_id_fkey;

alter table public.webhook_deliveries
  add constraint webhook_deliveries_booking_id_fkey
  foreign key (booking_id)
  references public.bookings(id)
  on delete cascade;


-- -- =============== PROFILES ===============
-- CREATE TABLE public.profiles (
--   id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
--   username TEXT NOT NULL UNIQUE,
--   display_name TEXT NOT NULL,
--   bio TEXT,
--   avatar_url TEXT,
--   timezone TEXT NOT NULL DEFAULT 'UTC',
--   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
--   updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
--   CONSTRAINT username_format CHECK (username ~ '^[a-z0-9][a-z0-9-]{2,39}$')
-- );
-- GRANT SELECT ON public.profiles TO anon;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
-- GRANT ALL ON public.profiles TO service_role;
-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "profiles_public_read" ON public.profiles FOR SELECT USING (true);
-- CREATE POLICY "profiles_owner_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
-- CREATE POLICY "profiles_owner_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
-- CREATE POLICY "profiles_owner_delete" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- =============== EVENT TYPES ===============
CREATE TABLE public.event_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  duration_min INTEGER NOT NULL CHECK (duration_min > 0 AND duration_min <= 480),
  buffer_before_min INTEGER NOT NULL DEFAULT 0 CHECK (buffer_before_min >= 0),
  buffer_after_min INTEGER NOT NULL DEFAULT 0 CHECK (buffer_after_min >= 0),
  min_notice_min INTEGER NOT NULL DEFAULT 60 CHECK (min_notice_min >= 0),
  max_advance_days INTEGER NOT NULL DEFAULT 60 CHECK (max_advance_days > 0),
  location TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  color TEXT NOT NULL DEFAULT '#0f6d8a',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug),
  CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,49}$')
);
GRANT SELECT ON public.event_types TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_types TO authenticated;
GRANT ALL ON public.event_types TO service_role;
ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event_types_public_active_read" ON public.event_types FOR SELECT USING (active = true);
CREATE POLICY "event_types_owner_read" ON public.event_types FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "event_types_owner_write" ON public.event_types FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "event_types_owner_update" ON public.event_types FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "event_types_owner_delete" ON public.event_types FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =============== AVAILABILITY RULES ===============
CREATE TABLE public.availability_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);
GRANT SELECT ON public.availability_rules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_rules TO authenticated;
GRANT ALL ON public.availability_rules TO service_role;
ALTER TABLE public.availability_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "avail_public_read" ON public.availability_rules FOR SELECT USING (true);
CREATE POLICY "avail_owner_write" ON public.availability_rules FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "avail_owner_update" ON public.availability_rules FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "avail_owner_delete" ON public.availability_rules FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =============== DATE OVERRIDES ===============
CREATE TABLE public.date_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  is_unavailable BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, override_date)
);
GRANT SELECT ON public.date_overrides TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.date_overrides TO authenticated;
GRANT ALL ON public.date_overrides TO service_role;
ALTER TABLE public.date_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "overrides_public_read" ON public.date_overrides FOR SELECT USING (true);
CREATE POLICY "overrides_owner_write" ON public.date_overrides FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "overrides_owner_update" ON public.date_overrides FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "overrides_owner_delete" ON public.date_overrides FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =============== BOOKINGS ===============
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type_id UUID NOT NULL REFERENCES public.event_types(id) ON DELETE CASCADE,
  host_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_name TEXT NOT NULL,
  invitee_email TEXT NOT NULL,
  invitee_notes TEXT,
  invitee_timezone TEXT NOT NULL DEFAULT 'UTC',
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled')),
  cancel_reason TEXT,
  cancel_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  reminder_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);
CREATE INDEX bookings_host_start_idx ON public.bookings (host_user_id, start_at);
CREATE INDEX bookings_status_start_idx ON public.bookings (status, start_at);
GRANT SELECT, INSERT ON public.bookings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
-- Host sees own bookings
CREATE POLICY "bookings_host_read" ON public.bookings FOR SELECT TO authenticated USING (auth.uid() = host_user_id);
CREATE POLICY "bookings_host_update" ON public.bookings FOR UPDATE TO authenticated USING (auth.uid() = host_user_id) WITH CHECK (auth.uid() = host_user_id);
CREATE POLICY "bookings_host_delete" ON public.bookings FOR DELETE TO authenticated USING (auth.uid() = host_user_id);
-- Public/invitee: booking creation and cancel-by-token happen through server functions with service role; no direct RLS insert path needed. Deny by default (no policy).

-- =============== WEBHOOK DELIVERIES ===============
CREATE TABLE public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.webhook_deliveries TO service_role;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
-- Server-only. No client policies.

-- =============== GOOGLE CALENDAR CONNECTIONS ===============
CREATE TABLE public.google_calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_key_ciphertext TEXT NOT NULL,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_calendar_connections TO authenticated;
GRANT ALL ON public.google_calendar_connections TO service_role;
ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gcal_owner_read" ON public.google_calendar_connections FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "gcal_owner_write" ON public.google_calendar_connections FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gcal_owner_update" ON public.google_calendar_connections FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gcal_owner_delete" ON public.google_calendar_connections FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =============== TRIGGERS ===============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_event_types_updated_at BEFORE UPDATE ON public.event_types FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_gcal_updated_at BEFORE UPDATE ON public.google_calendar_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup (best-effort; final username generated from email local-part with random suffix if collision)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  attempt INTEGER := 0;
BEGIN
  base_username := regexp_replace(lower(split_part(coalesce(NEW.email, 'user'), '@', 1)), '[^a-z0-9-]', '', 'g');
  IF length(base_username) < 3 THEN base_username := 'user' || substr(md5(NEW.id::text), 1, 6); END IF;
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) AND attempt < 5 LOOP
    attempt := attempt + 1;
    final_username := base_username || '-' || substr(md5(random()::text), 1, 4);
  END LOOP;
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    final_username,
    coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', base_username)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

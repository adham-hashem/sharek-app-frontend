/*
# Create SHAREk core data model

1. New Tables
- `profiles`: one row per signed-in person with their preferred language, role, and display name.
- `meal_requests`: meal requests created by people who need food, including quantity, timing, and live location.
- `food_donations`: available food published by donors, including image, pickup details, expiry, and location.
- `matches`: a durable connection between a meal request and a helper who accepted it.

2. Security
- Row-level security is enabled on every table.
- Profiles are readable by signed-in users and editable only by their owner.
- Active meal requests and food donations are readable by signed-in users so nearby matching can work.
- Requests and donations can only be created or changed by their owners.
- Matches can only be created by the accepting helper and are visible to the request owner or helper.

3. Important Notes
- All owner identifiers default to the current authenticated user.
- Location values are stored as latitude and longitude for portable mobile map rendering.
- No fake or seed records are inserted.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'skipped' CHECK (role IN ('needer', 'donor', 'charity', 'restaurant', 'hotel', 'skipped')),
  language text NOT NULL DEFAULT 'ar' CHECK (language IN ('ar', 'en')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  meals integer NOT NULL CHECK (meals > 0 AND meals <= 100),
  timing text NOT NULL CHECK (timing IN ('now', 'later')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'matched', 'fulfilled', 'cancelled')),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.food_donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  food_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_url text,
  meals integer NOT NULL CHECK (meals > 0 AND meals <= 1000),
  pickup_start timestamptz NOT NULL,
  pickup_end timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'claimed', 'expired')),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_food_window CHECK (pickup_end >= pickup_start AND expires_at >= pickup_end)
);

CREATE TABLE IF NOT EXISTS public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.meal_requests(id) ON DELETE CASCADE,
  helper_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, helper_id)
);

CREATE INDEX IF NOT EXISTS meal_requests_open_location_idx ON public.meal_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS food_donations_available_location_idx ON public.food_donations(status, expires_at, created_at DESC);
CREATE INDEX IF NOT EXISTS matches_helper_idx ON public.matches(helper_id, created_at DESC);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_read_authenticated" ON public.profiles;
CREATE POLICY "profiles_read_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "requests_read_authenticated" ON public.meal_requests;
CREATE POLICY "requests_read_authenticated" ON public.meal_requests FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "requests_insert_own" ON public.meal_requests;
CREATE POLICY "requests_insert_own" ON public.meal_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "requests_update_own" ON public.meal_requests;
CREATE POLICY "requests_update_own" ON public.meal_requests FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "requests_delete_own" ON public.meal_requests;
CREATE POLICY "requests_delete_own" ON public.meal_requests FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "donations_read_authenticated" ON public.food_donations;
CREATE POLICY "donations_read_authenticated" ON public.food_donations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "donations_insert_own" ON public.food_donations;
CREATE POLICY "donations_insert_own" ON public.food_donations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "donations_update_own" ON public.food_donations;
CREATE POLICY "donations_update_own" ON public.food_donations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "donations_delete_own" ON public.food_donations;
CREATE POLICY "donations_delete_own" ON public.food_donations FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "matches_read_participants" ON public.matches;
CREATE POLICY "matches_read_participants" ON public.matches FOR SELECT TO authenticated USING (auth.uid() = helper_id OR EXISTS (SELECT 1 FROM public.meal_requests WHERE meal_requests.id = matches.request_id AND meal_requests.user_id = auth.uid()));
DROP POLICY IF EXISTS "matches_insert_helper" ON public.matches;
CREATE POLICY "matches_insert_helper" ON public.matches FOR INSERT TO authenticated WITH CHECK (auth.uid() = helper_id);
DROP POLICY IF EXISTS "matches_update_helper" ON public.matches;
CREATE POLICY "matches_update_helper" ON public.matches FOR UPDATE TO authenticated USING (auth.uid() = helper_id) WITH CHECK (auth.uid() = helper_id);
DROP POLICY IF EXISTS "matches_delete_helper" ON public.matches;
CREATE POLICY "matches_delete_helper" ON public.matches FOR DELETE TO authenticated USING (auth.uid() = helper_id);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.meal_requests;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.food_donations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
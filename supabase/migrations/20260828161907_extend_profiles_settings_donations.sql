/*
# Extend SHAREk profiles and add settings + donations

1. Modified Tables
- `profiles`: adds phone, country, avatar_url, rating, meals_helped, meals_received columns.
  These are user-display fields. avatar_url stores a Supabase Storage path for the profile photo.
  rating is a numeric average (0-5) maintained by the system. meals_helped and meals_received
  are integer counters updated by the app when matches complete or requests are fulfilled.

2. New Tables
- `user_settings`: one row per user storing notification, sound, vibration, and location preferences.
  All boolean columns default to true (enabled) for a good first-run experience.
- `app_donations`: records financial contributions to SHAREk itself (separate from food donations).
  Stores amount, currency, and created_at.

3. Security
- RLS enabled on user_settings and app_donations.
- Profiles: column-level UPDATE grants extended to include the new user-editable columns (phone, country, avatar_url, full_name, language). Rating and meal counters remain protected — they are updated only through SECURITY DEFINER functions.
- user_settings: owner-scoped CRUD (authenticated only, auth.uid() = user_id).
- app_donations: owner-scoped insert and select. Users can see their own donation history.

4. New Functions
- `increment_meals_helped()`: called when a helper completes a match — increments meals_helped on the helper's profile.
- `increment_meals_received()`: called when a needer's request is fulfilled — increments meals_received on the needer's profile.
- `delete_own_account()`: deletes the caller's profile row and auth account. SECURITY DEFINER, derives caller from auth.uid().

5. Storage
- Creates `avatars` private bucket for profile photos, scoped to user folders.

6. Important Notes
- Rating defaults to 0 and is not directly user-writable.
- The update_own_profile_role function from a prior migration remains unchanged.
- user_settings rows are created automatically on first profile load if missing.
*/

-- Add columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rating numeric(3,2) NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS meals_helped integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS meals_received integer NOT NULL DEFAULT 0;

-- Grant UPDATE on the new user-editable columns
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, language, phone, country, avatar_url) ON public.profiles TO authenticated;

-- Create user_settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notifications_enabled boolean NOT NULL DEFAULT true,
  request_sound_enabled boolean NOT NULL DEFAULT true,
  vibration_enabled boolean NOT NULL DEFAULT true,
  location_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_read_own" ON public.user_settings;
CREATE POLICY "settings_read_own" ON public.user_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "settings_insert_own" ON public.user_settings;
CREATE POLICY "settings_insert_own" ON public.user_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "settings_update_own" ON public.user_settings;
CREATE POLICY "settings_update_own" ON public.user_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "settings_delete_own" ON public.user_settings;
CREATE POLICY "settings_delete_own" ON public.user_settings FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Create app_donations table
CREATE TABLE IF NOT EXISTS public.app_donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'SAR',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_donations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_donations_read_own" ON public.app_donations;
CREATE POLICY "app_donations_read_own" ON public.app_donations FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "app_donations_insert_own" ON public.app_donations;
CREATE POLICY "app_donations_insert_own" ON public.app_donations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS app_donations_user_idx ON public.app_donations(user_id, created_at DESC);

-- Functions for meal counters
CREATE OR REPLACE FUNCTION public.increment_meals_helped(p_meals integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_meals IS NULL OR p_meals < 1 OR p_meals > 1000 THEN
    RAISE EXCEPTION 'Invalid meal count';
  END IF;
  UPDATE public.profiles
  SET meals_helped = meals_helped + p_meals, updated_at = now()
  WHERE id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_meals_helped FROM anon;
GRANT EXECUTE ON FUNCTION public.increment_meals_helped TO authenticated;

CREATE OR REPLACE FUNCTION public.increment_meals_received(p_meals integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_meals IS NULL OR p_meals < 1 OR p_meals > 1000 THEN
    RAISE EXCEPTION 'Invalid meal count';
  END IF;
  UPDATE public.profiles
  SET meals_received = meals_received + p_meals, updated_at = now()
  WHERE id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_meals_received FROM anon;
GRANT EXECUTE ON FUNCTION public.increment_meals_received TO authenticated;

-- Delete account function
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM public.profiles WHERE id = v_uid;
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_own_account FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account TO authenticated;

-- Create avatars bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 2097152, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS "avatar_insert_own_folder" ON storage.objects;
CREATE POLICY "avatar_insert_own_folder" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatar_select_own_folder" ON storage.objects;
CREATE POLICY "avatar_select_own_folder" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatar_update_own_folder" ON storage.objects;
CREATE POLICY "avatar_update_own_folder" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatar_delete_own_folder" ON storage.objects;
CREATE POLICY "avatar_delete_own_folder" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
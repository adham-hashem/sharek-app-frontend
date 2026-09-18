BEGIN;

-- Keep the signup trigger compatible with databases that were migrated from
-- the earlier phone-first flow.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS religion text;

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- Auth always supplies the email in the new flow. Backfill old profiles before
-- enforcing the invariant required by email-based recovery.
UPDATE public.profiles p
SET email = lower(trim(u.email))
FROM auth.users u
WHERE u.id = p.id
  AND (p.email IS NULL OR trim(p.email) = '')
  AND u.email IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(new.email, '')));
  v_phone text := regexp_replace(coalesce(new.raw_user_meta_data->>'phone', ''), '[^0-9]', '', 'g');
  v_name text := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    split_part(v_email, '@', 1),
    'SHARek User'
  );
  v_language text := coalesce(new.raw_user_meta_data->>'language', 'ar');
  v_religion text := nullif(new.raw_user_meta_data->>'religion', '');
BEGIN
  IF v_email = '' THEN
    RAISE EXCEPTION 'A verified email is required to create a SHARek account';
  END IF;

  INSERT INTO public.profiles(id, full_name, email, phone, role, language, religion)
  VALUES (
    new.id,
    v_name,
    v_email,
    v_phone,
    'skipped',
    CASE WHEN v_language IN ('ar', 'en') THEN v_language ELSE 'ar' END,
    CASE WHEN v_religion IN ('muslim', 'christian', 'jewish', 'other') THEN v_religion ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = excluded.full_name,
      email = excluded.email,
      phone = excluded.phone,
      updated_at = now();

  INSERT INTO public.user_settings(user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_sharek_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_sharek_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

NOTIFY pgrst, 'reload schema';
COMMIT;

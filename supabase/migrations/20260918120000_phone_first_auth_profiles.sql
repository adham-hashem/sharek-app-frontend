BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '';

ALTER TABLE public.profiles
  ALTER COLUMN email DROP NOT NULL;

UPDATE public.profiles SET email = lower(trim(email)) WHERE email IS NOT NULL;
UPDATE public.profiles SET phone = regexp_replace(coalesce(phone, ''), '\s+', '', 'g');

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique_idx
  ON public.profiles(phone)
  WHERE phone <> '';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_idx
  ON public.profiles(lower(email))
  WHERE email IS NOT NULL AND email <> '';

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_phone text;
  v_name text;
  v_language text;
  v_religion text;
BEGIN
  v_email := lower(trim(coalesce(new.raw_user_meta_data->>'email', new.email, '')));
  v_phone := regexp_replace(coalesce(new.phone, new.raw_user_meta_data->>'phone', ''), '\s+', '', 'g');
  v_name := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(v_email, '@', 1), v_phone, 'SHARek User');
  v_language := coalesce(new.raw_user_meta_data->>'language', 'ar');
  v_religion := nullif(new.raw_user_meta_data->>'religion', '');

  INSERT INTO public.profiles(id, full_name, email, phone, role, language, religion)
  VALUES (
    new.id,
    v_name,
    nullif(v_email, ''),
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

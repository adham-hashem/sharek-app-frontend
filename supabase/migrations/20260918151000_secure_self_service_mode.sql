BEGIN;

CREATE OR REPLACE FUNCTION public.update_own_profile_mode(p_mode text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_mode NOT IN ('needer', 'donor') THEN
    RAISE EXCEPTION 'Invalid mode';
  END IF;

  UPDATE public.profiles
  SET mode = p_mode,
      updated_at = now()
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_own_profile_mode(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_own_profile_mode(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;

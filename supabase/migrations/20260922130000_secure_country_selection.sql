BEGIN;

-- Save country and its currency together without granting direct access to
-- protected profile columns through PostgREST.
CREATE OR REPLACE FUNCTION public.update_own_profile_country(p_country text, p_currency text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_country IS NULL OR char_length(trim(p_country)) <> 2
     OR p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'Invalid country or currency';
  END IF;

  UPDATE public.profiles
  SET country = upper(trim(p_country)), currency = p_currency, updated_at = now()
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_own_profile_country(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_own_profile_country(text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;

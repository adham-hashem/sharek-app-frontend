BEGIN;

-- Role selection is a normal onboarding choice. Authorization for admin-only
-- operations remains protected by is_profile_admin() and separate RPCs.
CREATE OR REPLACE FUNCTION public.update_own_profile_role(p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_role NOT IN ('needer', 'donor', 'charity', 'organization', 'restaurant', 'hotel') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  UPDATE public.profiles
  SET role = p_role,
      updated_at = now()
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_own_profile_role(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_own_profile_role(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;

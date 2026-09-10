/*
# Add column-level protection to SHAREk profiles

1. Security changes
- Revokes broad UPDATE on profiles so users can no longer change protected columns such as email or role through the data API.
- Grants UPDATE only on user-editable columns: full_name and language.
- Role changes are routed through a SECURITY DEFINER function that derives the actor from the session, never from a parameter.

2. Important Notes
- The role picker in the app now calls `update_own_profile_role()` instead of writing the role column directly.
- Auth email changes are handled by Supabase Auth, not the profiles table; email stays protected here.
*/

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, language) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.update_own_profile_role(p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_role NOT IN ('needer', 'donor', 'charity', 'restaurant', 'hotel', 'skipped') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  UPDATE public.profiles
  SET role = p_role, updated_at = now()
  WHERE id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_own_profile_role FROM anon;
GRANT EXECUTE ON FUNCTION public.update_own_profile_role TO authenticated;
/*
# Ensure anon cannot execute update_own_profile_role

1. Security changes
- Re-execute REVOKE on the SECURITY DEFINER function to guarantee anon cannot call it.
- authenticated keeps EXECUTE since signed-in users legitimately change their own role.
*/

REVOKE EXECUTE ON FUNCTION public.update_own_profile_role(p_role text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_own_profile_role(p_role text) TO authenticated;

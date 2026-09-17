BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mode text CHECK (mode IS NULL OR mode IN ('needer', 'donor'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_profile_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_admin = true
  );
$$;

CREATE TABLE IF NOT EXISTS public.role_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_name text NOT NULL DEFAULT '',
  requester_email text NOT NULL DEFAULT '',
  requested_role text NOT NULL CHECK (requested_role IN ('charity', 'organization', 'restaurant', 'hotel')),
  requested_mode text NOT NULL CHECK (requested_mode IN ('needer', 'donor')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes text NOT NULL DEFAULT '',
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_approval_requests_user_status_idx
  ON public.role_approval_requests(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS role_approval_requests_status_idx
  ON public.role_approval_requests(status, created_at DESC);

ALTER TABLE public.role_approval_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS role_requests_select_own_or_admin ON public.role_approval_requests;
CREATE POLICY role_requests_select_own_or_admin ON public.role_approval_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_profile_admin());

DROP POLICY IF EXISTS role_requests_insert_own ON public.role_approval_requests;
CREATE POLICY role_requests_insert_own ON public.role_approval_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS role_requests_update_admin ON public.role_approval_requests;
CREATE POLICY role_requests_update_admin ON public.role_approval_requests
  FOR UPDATE TO authenticated
  USING (public.is_profile_admin())
  WITH CHECK (public.is_profile_admin());

CREATE OR REPLACE FUNCTION public.submit_role_approval_request(p_role text, p_mode text DEFAULT 'donor')
RETURNS public.role_approval_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%rowtype;
  v_request public.role_approval_requests;
BEGIN
  IF p_role NOT IN ('charity', 'organization', 'restaurant', 'hotel') THEN
    RAISE EXCEPTION 'Invalid approvable role';
  END IF;

  IF p_mode NOT IN ('needer', 'donor') THEN
    RAISE EXCEPTION 'Invalid mode';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  SELECT * INTO v_request
  FROM public.role_approval_requests
  WHERE user_id = auth.uid()
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.role_approval_requests
    SET requested_role = p_role,
        requested_mode = p_mode,
        requester_name = coalesce(v_profile.full_name, ''),
        requester_email = coalesce(v_profile.email, ''),
        updated_at = now()
    WHERE id = v_request.id
    RETURNING * INTO v_request;
  ELSE
    INSERT INTO public.role_approval_requests(user_id, requester_name, requester_email, requested_role, requested_mode)
    VALUES (auth.uid(), coalesce(v_profile.full_name, ''), coalesce(v_profile.email, ''), p_role, p_mode)
    RETURNING * INTO v_request;
  END IF;

  RETURN v_request;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_approve_role_request(p_request_id uuid, p_notes text DEFAULT '')
RETURNS public.role_approval_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.role_approval_requests;
BEGIN
  IF NOT public.is_profile_admin() THEN
    RAISE EXCEPTION 'Administrator access is required';
  END IF;

  SELECT * INTO v_request
  FROM public.role_approval_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  UPDATE public.profiles
  SET role = v_request.requested_role,
      mode = v_request.requested_mode,
      updated_at = now()
  WHERE id = v_request.user_id;

  UPDATE public.role_approval_requests
  SET status = 'approved',
      admin_notes = coalesce(p_notes, ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  WHERE id = p_request_id
  RETURNING * INTO v_request;

  RETURN v_request;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_role_request(p_request_id uuid, p_notes text DEFAULT '')
RETURNS public.role_approval_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.role_approval_requests;
BEGIN
  IF NOT public.is_profile_admin() THEN
    RAISE EXCEPTION 'Administrator access is required';
  END IF;

  UPDATE public.role_approval_requests
  SET status = 'rejected',
      admin_notes = coalesce(p_notes, ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  WHERE id = p_request_id
  RETURNING * INTO v_request;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  RETURN v_request;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_role_approval_request(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_role_approval_request(text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_approve_role_request(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_approve_role_request(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_reject_role_request(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_reject_role_request(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_profile_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_profile_admin() TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

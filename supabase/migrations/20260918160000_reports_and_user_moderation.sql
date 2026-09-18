BEGIN;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_reason text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'other',
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  admin_notes text NOT NULL DEFAULT '',
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_reports_status_created_idx ON public.user_reports(status, created_at DESC);
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_reports_insert_own ON public.user_reports;
CREATE POLICY user_reports_insert_own ON public.user_reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
DROP POLICY IF EXISTS user_reports_select_own_or_admin ON public.user_reports;
CREATE POLICY user_reports_select_own_or_admin ON public.user_reports FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR public.is_profile_admin());
DROP POLICY IF EXISTS user_reports_update_admin ON public.user_reports;
CREATE POLICY user_reports_update_admin ON public.user_reports FOR UPDATE TO authenticated USING (public.is_profile_admin()) WITH CHECK (public.is_profile_admin());

CREATE OR REPLACE FUNCTION public.admin_set_user_suspension(p_user_id uuid, p_suspended boolean, p_reason text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_profile_admin() THEN RAISE EXCEPTION 'Administrator access is required'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'Administrators cannot suspend themselves'; END IF;
  UPDATE public.profiles SET is_suspended = p_suspended, suspended_reason = CASE WHEN p_suspended THEN coalesce(p_reason, '') ELSE '' END, updated_at = now() WHERE id = p_user_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_suspension(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_suspension(uuid, boolean, text) TO authenticated;

COMMIT;

CREATE TABLE IF NOT EXISTS public.push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL CHECK (char_length(expo_push_token) BETWEEN 20 AND 255),
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  enabled boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, expo_push_token)
);

ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_devices_own_select ON public.push_devices;
CREATE POLICY push_devices_own_select ON public.push_devices FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS push_devices_own_insert ON public.push_devices;
CREATE POLICY push_devices_own_insert ON public.push_devices FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS push_devices_own_update ON public.push_devices;
CREATE POLICY push_devices_own_update ON public.push_devices FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS push_devices_own_delete ON public.push_devices;
CREATE POLICY push_devices_own_delete ON public.push_devices FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS push_devices_user_enabled_idx ON public.push_devices(user_id, enabled);

REVOKE ALL ON public.push_devices FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_devices TO authenticated;

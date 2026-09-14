-- Support and verification persistence used by the support and "be verified"
-- screens. Payments are currently disabled in the app, but keeping the schema
-- available prevents broken reads and makes later payment reactivation safe.

CREATE TABLE IF NOT EXISTS public.support_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled')),
  stripe_session_id text,
  stripe_payment_intent text,
  transaction_ref text NOT NULL DEFAULT ('SUP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_transactions_user_created_idx
  ON public.support_transactions(user_id, created_at DESC);

ALTER TABLE public.support_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_transactions_read_own ON public.support_transactions;
CREATE POLICY support_transactions_read_own ON public.support_transactions
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR (auth.jwt() -> 'app_metadata' ->> 'is_admin') = 'true'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS support_transactions_insert_own ON public.support_transactions;
CREATE POLICY support_transactions_insert_own ON public.support_transactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS support_transactions_update_admin ON public.support_transactions;
CREATE POLICY support_transactions_update_admin ON public.support_transactions
  FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'is_admin') = 'true' OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'is_admin') = 'true' OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE TABLE IF NOT EXISTS public.verification_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL UNIQUE,
  currency text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.verification_fees(country_code, currency, amount, is_active)
VALUES
  ('AE', 'AED', 0, true),
  ('SA', 'SAR', 0, true),
  ('EG', 'EGP', 0, true),
  ('US', 'USD', 0, true)
ON CONFLICT (country_code) DO NOTHING;

ALTER TABLE public.verification_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS verification_fees_read_authenticated ON public.verification_fees;
CREATE POLICY verification_fees_read_authenticated ON public.verification_fees
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS verification_fees_admin_write ON public.verification_fees;
CREATE POLICY verification_fees_admin_write ON public.verification_fees
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'is_admin') = 'true' OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'is_admin') = 'true' OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE TABLE IF NOT EXISTS public.verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'suspended')),
  fee_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  fee_currency text NOT NULL DEFAULT 'USD' CHECK (fee_currency ~ '^[A-Z]{3}$'),
  stripe_session_id text,
  stripe_payment_intent text,
  transaction_ref text NOT NULL DEFAULT ('VER-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'failed')),
  admin_notes text NOT NULL DEFAULT '',
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS verification_requests_user_created_idx
  ON public.verification_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS verification_requests_status_created_idx
  ON public.verification_requests(status, created_at DESC);

ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS verification_requests_read_own ON public.verification_requests;
CREATE POLICY verification_requests_read_own ON public.verification_requests
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR (auth.jwt() -> 'app_metadata' ->> 'is_admin') = 'true'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS verification_requests_insert_own ON public.verification_requests;
CREATE POLICY verification_requests_insert_own ON public.verification_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS verification_requests_update_admin ON public.verification_requests;
CREATE POLICY verification_requests_update_admin ON public.verification_requests
  FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'is_admin') = 'true' OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'is_admin') = 'true' OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE OR REPLACE FUNCTION public.get_verification_fee(p_country_code text)
RETURNS public.verification_fees
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.verification_fees
  WHERE is_active = true
    AND country_code = upper(coalesce(nullif(trim(p_country_code), ''), 'US'))
  UNION ALL
  SELECT *
  FROM public.verification_fees
  WHERE is_active = true
    AND country_code = 'US'
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_verification_fee(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_verification_fee(text) TO authenticated;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.support_transactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.verification_requests;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';

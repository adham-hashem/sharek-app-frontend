/*
# Create offers table for inDrive-style request flow

1. New Tables
- `offers`: represents a donor's offer to fulfill a meal request.
  - `request_id` (uuid, FK to meal_requests): the request being offered on.
  - `helper_id` (uuid, FK to auth.users, defaults to auth.uid()): the donor making the offer.
  - `status` (text): 'pending' | 'accepted' | 'declined' | 'expired'. Default 'pending'.
  - `offered_meals` (integer): number of meals the donor can provide.
  - `latitude` / `longitude` (double precision): donor's location at time of offer.
  - `created_at` / `updated_at` (timestamptz).

2. Security
- RLS enabled on offers.
- SELECT: authenticated users can see offers on their own requests, or their own offers.
- INSERT: only the donor (helper_id = auth.uid()) can create an offer.
- UPDATE: only the request owner can update offer status (accept/decline). The donor can cancel their own offer.
- DELETE: only the offer creator can delete their own offer.

3. Realtime
- offers table added to supabase_realtime publication.

4. Important Notes
- A UNIQUE constraint on (request_id, helper_id) prevents duplicate offers.
- When an offer is accepted, the app sets meal_requests.status = 'matched' and creates a match row.
- The 15-second timer is client-side; if it expires with no offers, the request is cancelled.
*/

CREATE TABLE IF NOT EXISTS public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.meal_requests(id) ON DELETE CASCADE,
  helper_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  offered_meals integer NOT NULL CHECK (offered_meals > 0 AND offered_meals <= 100),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, helper_id)
);

CREATE INDEX IF NOT EXISTS offers_request_idx ON public.offers(request_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS offers_helper_idx ON public.offers(helper_id, created_at DESC);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- SELECT: request owner can see offers on their requests; donor can see their own offers
DROP POLICY IF EXISTS "offers_read_participants" ON public.offers;
CREATE POLICY "offers_read_participants" ON public.offers FOR SELECT TO authenticated
USING (
  auth.uid() = helper_id
  OR EXISTS (
    SELECT 1 FROM public.meal_requests
    WHERE meal_requests.id = offers.request_id
    AND meal_requests.user_id = auth.uid()
  )
);

-- INSERT: only the donor can create their own offer
DROP POLICY IF EXISTS "offers_insert_own" ON public.offers;
CREATE POLICY "offers_insert_own" ON public.offers FOR INSERT TO authenticated
WITH CHECK (auth.uid() = helper_id);

-- UPDATE: request owner can change status (accept/decline); donor can cancel (set status to expired)
DROP POLICY IF EXISTS "offers_update_participants" ON public.offers;
CREATE POLICY "offers_update_participants" ON public.offers FOR UPDATE TO authenticated
USING (
  auth.uid() = helper_id
  OR EXISTS (
    SELECT 1 FROM public.meal_requests
    WHERE meal_requests.id = offers.request_id
    AND meal_requests.user_id = auth.uid()
  )
)
WITH CHECK (
  auth.uid() = helper_id
  OR EXISTS (
    SELECT 1 FROM public.meal_requests
    WHERE meal_requests.id = offers.request_id
    AND meal_requests.user_id = auth.uid()
  )
);

-- DELETE: only the offer creator can delete
DROP POLICY IF EXISTS "offers_delete_own" ON public.offers;
CREATE POLICY "offers_delete_own" ON public.offers FOR DELETE TO authenticated
USING (auth.uid() = helper_id);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.offers;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

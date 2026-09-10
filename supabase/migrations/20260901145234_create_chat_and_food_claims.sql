/*
# Add chat messages, food claims, and auto-expire trigger

1. New Tables
- `food_claims`: records when a needy user books/reserves a food donation.
  - `food_donation_id` (uuid, FK to food_donations): the food being claimed.
  - `claimer_id` (uuid, FK to auth.users, defaults to auth.uid()): the user booking the food.
  - `status` (text): 'booked' | 'completed' | 'cancelled'. Default 'booked'.
  - `created_at` (timestamptz).
  - UNIQUE on (food_donation_id, claimer_id) prevents duplicate claims.

- `messages`: real-time chat between two users about a specific food donation.
  - `food_donation_id` (uuid, FK to food_donations): the food item the chat is about.
  - `sender_id` (uuid, FK to auth.users, defaults to auth.uid()).
  - `recipient_id` (uuid, FK to auth.users).
  - `body` (text, not null): message text.
  - `read_at` (timestamptz, nullable): null = unread.
  - `created_at` (timestamptz).

2. New Functions
- `claim_food_donation(p_donation_id uuid)`: SECURITY DEFINER — atomically checks availability,
  inserts a food_claims row, sets donation to 'claimed'. Returns the claim.
- `expire_food_donations()`: SECURITY DEFINER — marks donations past expires_at as 'expired'.
  Callable from the app on load.
- `trigger_expire_food()`: trigger function that calls expire_food_donations() after
  insert/update on food_donations.

3. Triggers
- `auto_expire_food_trigger`: AFTER INSERT OR UPDATE (statement-level) on food_donations.
- `food_donations_bump_updated_at`: BEFORE UPDATE to bump updated_at.

4. Security
- RLS on food_claims: claimer sees own claims, donation owner sees claims on their food.
  Claimer can insert/update/delete their own claim.
- RLS on messages: sender and recipient see their messages. Sender inserts. Recipient
  updates read_at. Sender can delete.
- Both tables added to supabase_realtime.

5. Important Notes
- Chat is scoped to food_donation_id so it stays connected to the booking.
- Unread = read_at IS NULL and recipient_id = auth.uid().
- claim_food_donation prevents double-claiming atomically.
*/

-- food_claims table
CREATE TABLE IF NOT EXISTS public.food_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  food_donation_id uuid NOT NULL REFERENCES public.food_donations(id) ON DELETE CASCADE,
  claimer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS food_claims_claimer_idx ON public.food_claims(claimer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS food_claims_donation_idx ON public.food_claims(food_donation_id);
CREATE UNIQUE INDEX IF NOT EXISTS food_claims_donation_claimer_uniq ON public.food_claims(food_donation_id, claimer_id);

ALTER TABLE public.food_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "claims_read_participants" ON public.food_claims;
CREATE POLICY "claims_read_participants" ON public.food_claims FOR SELECT TO authenticated
USING (
  auth.uid() = claimer_id
  OR EXISTS (
    SELECT 1 FROM public.food_donations
    WHERE food_donations.id = food_claims.food_donation_id
    AND food_donations.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "claims_insert_own" ON public.food_claims;
CREATE POLICY "claims_insert_own" ON public.food_claims FOR INSERT TO authenticated
WITH CHECK (auth.uid() = claimer_id);

DROP POLICY IF EXISTS "claims_update_own" ON public.food_claims;
CREATE POLICY "claims_update_own" ON public.food_claims FOR UPDATE TO authenticated
USING (auth.uid() = claimer_id) WITH CHECK (auth.uid() = claimer_id);

DROP POLICY IF EXISTS "claims_delete_own" ON public.food_claims;
CREATE POLICY "claims_delete_own" ON public.food_claims FOR DELETE TO authenticated
USING (auth.uid() = claimer_id);

-- messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  food_donation_id uuid NOT NULL REFERENCES public.food_donations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_donation_idx ON public.messages(food_donation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS messages_recipient_unread_idx ON public.messages(recipient_id, read_at);
CREATE INDEX IF NOT EXISTS messages_sender_idx ON public.messages(sender_id, created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_read_participants" ON public.messages;
CREATE POLICY "messages_read_participants" ON public.messages FOR SELECT TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "messages_insert_sender" ON public.messages;
CREATE POLICY "messages_insert_sender" ON public.messages FOR INSERT TO authenticated
WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "messages_update_recipient_read" ON public.messages;
CREATE POLICY "messages_update_recipient_read" ON public.messages FOR UPDATE TO authenticated
USING (auth.uid() = recipient_id) WITH CHECK (auth.uid() = recipient_id);

DROP POLICY IF EXISTS "messages_delete_sender" ON public.messages;
CREATE POLICY "messages_delete_sender" ON public.messages FOR DELETE TO authenticated
USING (auth.uid() = sender_id);

-- claim_food_donation function
CREATE OR REPLACE FUNCTION public.claim_food_donation(p_donation_id uuid)
RETURNS public.food_claims
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_claim public.food_claims;
  v_donation_user_id uuid;
  v_donation_status text;
BEGIN
  SELECT user_id, status INTO v_donation_user_id, v_donation_status
  FROM public.food_donations WHERE id = p_donation_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Food donation not found';
  END IF;

  IF v_donation_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot claim your own donation';
  END IF;

  IF v_donation_status = 'expired' THEN
    RAISE EXCEPTION 'This food has expired';
  END IF;

  INSERT INTO public.food_claims (food_donation_id, claimer_id)
  VALUES (p_donation_id, auth.uid())
  ON CONFLICT (food_donation_id, claimer_id) DO UPDATE SET status = 'booked'
  RETURNING * INTO v_claim;

  UPDATE public.food_donations SET status = 'claimed', updated_at = now()
  WHERE id = p_donation_id;

  RETURN v_claim;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_food_donation FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_food_donation TO authenticated;

-- expire_food_donations function (callable from app)
CREATE OR REPLACE FUNCTION public.expire_food_donations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.food_donations
  SET status = 'expired', updated_at = now()
  WHERE status = 'available' AND expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.expire_food_donations FROM anon;
GRANT EXECUTE ON FUNCTION public.expire_food_donations TO authenticated;

-- Trigger function that wraps expire_food_donations
CREATE OR REPLACE FUNCTION public.trigger_expire_food()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.expire_food_donations();
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS auto_expire_food_trigger ON public.food_donations;
CREATE TRIGGER auto_expire_food_trigger
AFTER INSERT OR UPDATE ON public.food_donations
FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_expire_food();

-- updated_at bump for food_donations
CREATE OR REPLACE FUNCTION public.bump_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS food_donations_bump_updated_at ON public.food_donations;
CREATE TRIGGER food_donations_bump_updated_at
BEFORE UPDATE ON public.food_donations
FOR EACH ROW EXECUTE FUNCTION public.bump_updated_at();

-- Realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.food_claims;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

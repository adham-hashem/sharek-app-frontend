/*
# Add meal request chat support

The messages table currently requires food_donation_id (NOT NULL with FK).
Meal requests need chat too, so we:
1. Make food_donation_id nullable
2. Add meal_request_id column (nullable, FK to meal_requests)
3. Add a CHECK constraint ensuring at least one of the two is set
4. Add index on meal_request_id
5. Add RLS policies for meal request chat (participants only)
*/

-- 1. Make food_donation_id nullable so meal-request-only chats can exist
ALTER TABLE public.messages ALTER COLUMN food_donation_id DROP NOT NULL;

-- 2. Add meal_request_id column
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS meal_request_id uuid REFERENCES public.meal_requests(id) ON DELETE CASCADE;

-- 3. Ensure at least one reference is set
ALTER TABLE public.messages
  ADD CONSTRAINT messages_at_least_one_ref
  CHECK (food_donation_id IS NOT NULL OR meal_request_id IS NOT NULL);

-- 4. Index for meal_request_id lookups
CREATE INDEX IF NOT EXISTS messages_meal_request_idx
  ON public.messages(meal_request_id, created_at ASC);

-- 5. RLS policies for meal request chat
-- SELECT: sender or recipient only
CREATE POLICY "select_own_meal_request_messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    meal_request_id IS NOT NULL
    AND (sender_id = auth.uid() OR recipient_id = auth.uid())
  );

-- INSERT: sender must be the authenticated user
CREATE POLICY "insert_own_meal_request_messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    meal_request_id IS NOT NULL
    AND sender_id = auth.uid()
  );

-- UPDATE: only sender can update (e.g., read_at)
CREATE POLICY "update_own_meal_request_messages"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid())
  WITH CHECK (sender_id = auth.uid() OR recipient_id = auth.uid());

-- DELETE: sender can delete their own messages
CREATE POLICY "delete_own_meal_request_messages"
  ON public.messages FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid());

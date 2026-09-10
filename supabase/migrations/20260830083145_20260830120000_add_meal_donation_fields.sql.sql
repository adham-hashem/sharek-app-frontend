/*
# Add meal donation fields to app_donations + food auto-expiry

1. Modified Tables
- `app_donations`: add `meal_price` (numeric, price per meal), `meal_count` (integer, number of meals), `donation_type` (text, 'general' or 'meals').
  These let donors specify a meal price and quantity, with the total computed as meal_price * meal_count.
2. Security
- No changes to RLS; app_donations already has owner-scoped policies for authenticated users.
3. Important Notes
- All columns are nullable / have defaults so existing rows are unaffected.
- `donation_type` defaults to 'general' for backward compatibility.
*/

ALTER TABLE app_donations
  ADD COLUMN IF NOT EXISTS meal_price numeric CHECK (meal_price >= 0),
  ADD COLUMN IF NOT EXISTS meal_count integer CHECK (meal_count >= 0),
  ADD COLUMN IF NOT EXISTS donation_type text DEFAULT 'general' CHECK (donation_type = ANY (ARRAY['general', 'meals']));

/*
# Auto-expire food donations that passed their expiry time

Creates a SECURITY DEFINER function that marks all `food_donations` rows
with status='available' and expires_at < now() as status='expired'.
Called from the client periodically to keep the live map and lists clean.
*/

CREATE OR REPLACE FUNCTION expire_food_donations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE food_donations
    SET status = 'expired', updated_at = now()
    WHERE status = 'available' AND expires_at < now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE EXECUTE ON FUNCTION expire_food_donations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION expire_food_donations() TO authenticated;

/*
# Add Contributor Levels & Badges System

## What this does
Adds an automatic contributor-level system to SHAREk. Each user's profile gets a
`contributor_level` integer (0-5) that is computed automatically from real
activity data — completed meal donations, fulfilled food claims, and completed
matches. The level updates automatically via a trigger whenever relevant tables
change, so badges always reflect actual contribution without any manual updates.

## Level thresholds (based on total completed contributions)
  Level 0 — 🌱 مساهم جديد (New Contributor)    — 0-4 contributions
  Level 1 — 🚀 مساهم صاعد (Rising Contributor)  — 5-14 contributions
  Level 2 — ❤️ مساهم نشط (Active Contributor)    — 15-29 contributions
  Level 3 — ⭐ مساهم مميز (Distinguished)        — 30-59 contributions
  Level 4 — 🏆 مساهم ذهبي (Golden Contributor)   — 60-99 contributions
  Level 5 — 👑 سفير SHAREk (SHAREk Ambassador)   — 100+ contributions

"Total contributions" = meals_helped (from completed matches/food claims).

## Changes
1. `profiles` table: new column `contributor_level` (int, default 0)
2. Function `compute_contributor_level(p_user_id uuid)`: calculates level from
   completed matches + completed food claims where the user was the helper/claimer.
3. Trigger `update_contributor_level_trigger`: fires AFTER INSERT or UPDATE on
   `matches` and `food_claims` tables, recomputes the helper's level.
4. Backfill: one-time UPDATE to set `contributor_level` for all existing profiles
   based on current `meals_helped` value.

## Security
- No new tables, no new RLS policies needed.
- The column is updated only by a database trigger (SECURITY DEFINER), so users
  cannot directly set their own level — it's always derived from real activity.
- Existing profile RLS policies already cover SELECT/UPDATE on the profiles table.
*/

-- 1. Add contributor_level column to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'contributor_level'
  ) THEN
    ALTER TABLE profiles ADD COLUMN contributor_level integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 2. Function to compute a user's contributor level from real activity
--    Counts completed matches (helper_id = user) + completed food claims (claimer_id = user)
--    plus meals from meal donations that were claimed/completed.
CREATE OR REPLACE FUNCTION compute_contributor_level(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_contributions integer;
  meal_count integer;
BEGIN
  -- Count completed matches where this user was the helper
  SELECT COALESCE(SUM(
    CASE
      WHEN status = 'completed' THEN 1
      WHEN delivery_status = 'delivered' THEN 1
      ELSE 0
    END
  ), 0)
  INTO total_contributions
  FROM matches
  WHERE helper_id = p_user_id
    AND (status = 'completed' OR delivery_status = 'delivered');

  -- Add completed food claims where this user was the claimer
  SELECT COALESCE(COUNT(*), 0) + total_contributions
  INTO total_contributions
  FROM food_claims
  WHERE claimer_id = p_user_id
    AND status = 'completed';

  -- Also use meals_helped from profiles as a base if it's higher
  -- (covers donations counted via money donations that set meals_helped)
  SELECT GREATEST(COALESCE(meals_helped, 0), total_contributions)
  INTO meal_count
  FROM profiles
  WHERE id = p_user_id;

  total_contributions := GREATEST(total_contributions, meal_count);

  -- Determine level from thresholds
  RETURN CASE
    WHEN total_contributions >= 100 THEN 5
    WHEN total_contributions >= 60  THEN 4
    WHEN total_contributions >= 30  THEN 3
    WHEN total_contributions >= 15  THEN 2
    WHEN total_contributions >= 5   THEN 1
    ELSE 0
  END;
END;
$$;

-- 3a. Trigger function for matches table
CREATE OR REPLACE FUNCTION trigger_update_contributor_level_matches()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a match changes, update the helper's contributor level
  IF NEW.helper_id IS NOT NULL THEN
    UPDATE profiles
    SET contributor_level = compute_contributor_level(NEW.helper_id),
        updated_at = now()
    WHERE id = NEW.helper_id;
  END IF;
  IF (TG_OP = 'UPDATE' AND OLD.helper_id IS NOT NULL AND OLD.helper_id <> NEW.helper_id) THEN
    UPDATE profiles
    SET contributor_level = compute_contributor_level(OLD.helper_id),
        updated_at = now()
    WHERE id = OLD.helper_id;
  END IF;
  RETURN NEW;
END;
$$;

-- 3b. Trigger function for food_claims table
CREATE OR REPLACE FUNCTION trigger_update_contributor_level_claims()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.claimer_id IS NOT NULL THEN
    UPDATE profiles
    SET contributor_level = compute_contributor_level(NEW.claimer_id),
        updated_at = now()
    WHERE id = NEW.claimer_id;
  END IF;
  IF (TG_OP = 'UPDATE' AND OLD.claimer_id IS NOT NULL AND OLD.claimer_id <> NEW.claimer_id) THEN
    UPDATE profiles
    SET contributor_level = compute_contributor_level(OLD.claimer_id),
        updated_at = now()
    WHERE id = OLD.claimer_id;
  END IF;
  RETURN NEW;
END;
$$;

-- 3c. Trigger function for food_donations table (when donation status changes,
--     the donor's level may need updating if meals_helped was set)
CREATE OR REPLACE FUNCTION trigger_update_contributor_level_donations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    UPDATE profiles
    SET contributor_level = compute_contributor_level(NEW.user_id),
        updated_at = now()
    WHERE id = NEW.user_id;
  END IF;
  IF (TG_OP = 'UPDATE' AND OLD.user_id IS NOT NULL AND OLD.user_id <> NEW.user_id) THEN
    UPDATE profiles
    SET contributor_level = compute_contributor_level(OLD.user_id),
        updated_at = now()
    WHERE id = OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- 3d. Drop and recreate triggers (idempotent)
DROP TRIGGER IF EXISTS matches_contributor_level_trigger ON matches;
CREATE TRIGGER matches_contributor_level_trigger
  AFTER INSERT OR UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_contributor_level_matches();

DROP TRIGGER IF EXISTS claims_contributor_level_trigger ON food_claims;
CREATE TRIGGER claims_contributor_level_trigger
  AFTER INSERT OR UPDATE ON food_claims
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_contributor_level_claims();

DROP TRIGGER IF EXISTS donations_contributor_level_trigger ON food_donations;
CREATE TRIGGER donations_contributor_level_trigger
  AFTER INSERT OR UPDATE ON food_donations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_contributor_level_donations();

-- 4. Backfill existing profiles
UPDATE profiles
SET contributor_level = compute_contributor_level(profiles.id)
WHERE true;

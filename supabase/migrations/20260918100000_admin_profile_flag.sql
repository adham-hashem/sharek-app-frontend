BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';

COMMIT;

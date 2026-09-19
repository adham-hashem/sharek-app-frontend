BEGIN;

-- Food donation photos are intentionally visible to people browsing available
-- meals. Writes remain restricted to the authenticated owner's folder by the
-- existing insert/update/delete policies.
UPDATE storage.buckets
SET public = true
WHERE id = 'food-photos';

DROP POLICY IF EXISTS "food_photo_select_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "food_photo_select_visible" ON storage.objects;

CREATE POLICY "food_photo_select_visible"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'food-photos');

NOTIFY pgrst, 'reload schema';

COMMIT;

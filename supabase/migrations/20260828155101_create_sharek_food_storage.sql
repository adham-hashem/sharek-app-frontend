/*
# Create private SHAREk food photo storage

1. Storage
- Creates a private `food-photos` bucket for user-uploaded meal photos.
- Limits uploads to common image formats and 5 MB per object.

2. Security
- Authenticated users may upload only inside their own user-id folder.
- Authenticated users may read, update, and delete only their own photos.
- The bucket remains private so image access is not permanently public.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('food-photos', 'food-photos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS "food_photo_insert_own_folder" ON storage.objects;
CREATE POLICY "food_photo_insert_own_folder" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'food-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "food_photo_select_own_folder" ON storage.objects;
CREATE POLICY "food_photo_select_own_folder" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'food-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "food_photo_update_own_folder" ON storage.objects;
CREATE POLICY "food_photo_update_own_folder" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'food-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'food-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "food_photo_delete_own_folder" ON storage.objects;
CREATE POLICY "food_photo_delete_own_folder" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'food-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
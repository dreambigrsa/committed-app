-- Fix Status media uploads/signing by ensuring the `status-media` bucket exists
-- and has proper Storage RLS policies.
--
-- Symptoms this fixes:
-- - "Error creating signed URL: StorageApiError: Object not found"
-- - "Failed to post status, please try again later"
--
-- NOTE: This keeps `media` bucket policies intact and adds `status-media` bucket + policies.

-- Create storage bucket for status media (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('status-media', 'status-media', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for status-media bucket
-- (If you already have policies with these names, this will error; in that case delete/rename existing ones.)
DO $$
BEGIN
  -- SELECT: allow reading status media (signed URLs still require object existence)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Anyone can view status media'
  ) THEN
    EXECUTE format(
      'CREATE POLICY %I ON storage.objects FOR SELECT USING (bucket_id = %L)',
      'Anyone can view status media',
      'status-media'
    );
  END IF;

  -- INSERT: authenticated users can upload status media
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload status media'
  ) THEN
    EXECUTE format(
      'CREATE POLICY %I ON storage.objects FOR INSERT WITH CHECK (bucket_id = %L AND auth.role() = %L)',
      'Authenticated users can upload status media',
      'status-media',
      'authenticated'
    );
  END IF;

  -- UPDATE: users can update own status media
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can update own status media'
  ) THEN
    EXECUTE format(
      'CREATE POLICY %I ON storage.objects FOR UPDATE USING (bucket_id = %L AND auth.uid()::text = owner)',
      'Users can update own status media',
      'status-media'
    );
  END IF;

  -- DELETE: users can delete own status media
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can delete own status media'
  ) THEN
    EXECUTE format(
      'CREATE POLICY %I ON storage.objects FOR DELETE USING (bucket_id = %L AND auth.uid()::text = owner)',
      'Users can delete own status media',
      'status-media'
    );
  END IF;
END $$;



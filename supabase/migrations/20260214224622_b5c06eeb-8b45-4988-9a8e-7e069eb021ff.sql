
-- Add bio and avatar_url columns to drivers
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create storage bucket for driver avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('driver-avatars', 'driver-avatars', true);

-- Storage policies
CREATE POLICY "Anyone can view driver avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'driver-avatars');

CREATE POLICY "Anyone can upload driver avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'driver-avatars');

CREATE POLICY "Anyone can update driver avatars"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'driver-avatars');

CREATE POLICY "Anyone can delete driver avatars"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'driver-avatars');


-- Add banking fields to drivers table
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_agency text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS pix_key text,
  ADD COLUMN IF NOT EXISTS pix_key_name text,
  ADD COLUMN IF NOT EXISTS pix_key_type text;

-- Create driver_documents table
CREATE TABLE IF NOT EXISTS public.driver_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read driver_documents" ON public.driver_documents FOR SELECT USING (true);
CREATE POLICY "Anyone can insert driver_documents" ON public.driver_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update driver_documents" ON public.driver_documents FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete driver_documents" ON public.driver_documents FOR DELETE USING (true);

-- Create storage bucket for driver documents
INSERT INTO storage.buckets (id, name, public) VALUES ('driver-documents', 'driver-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Anyone can upload driver documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'driver-documents');
CREATE POLICY "Anyone can read driver documents" ON storage.objects FOR SELECT USING (bucket_id = 'driver-documents');
CREATE POLICY "Anyone can delete driver documents" ON storage.objects FOR DELETE USING (bucket_id = 'driver-documents');


-- Add reason and photo_url columns to ps_entries
ALTER TABLE public.ps_entries ADD COLUMN reason text;
ALTER TABLE public.ps_entries ADD COLUMN photo_url text;

-- Create ps_reasons table for custom PS reasons per unit
CREATE TABLE public.ps_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id),
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on ps_reasons
ALTER TABLE public.ps_reasons ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as piso_reasons)
CREATE POLICY "Anyone can read ps_reasons" ON public.ps_reasons FOR SELECT USING (true);
CREATE POLICY "Anyone can insert ps_reasons" ON public.ps_reasons FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update ps_reasons" ON public.ps_reasons FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete ps_reasons" ON public.ps_reasons FOR DELETE USING (true);

-- Create storage bucket for PS photos
INSERT INTO storage.buckets (id, name, public) VALUES ('ps-photos', 'ps-photos', true);

-- Storage policies for ps-photos bucket
CREATE POLICY "Anyone can read ps-photos" ON storage.objects FOR SELECT USING (bucket_id = 'ps-photos');
CREATE POLICY "Anyone can upload ps-photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'ps-photos');
CREATE POLICY "Anyone can update ps-photos" ON storage.objects FOR UPDATE USING (bucket_id = 'ps-photos');
CREATE POLICY "Anyone can delete ps-photos" ON storage.objects FOR DELETE USING (bucket_id = 'ps-photos');

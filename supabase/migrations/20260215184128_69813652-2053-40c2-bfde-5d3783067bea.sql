
-- Create piso_entries table
CREATE TABLE public.piso_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tbr_code TEXT NOT NULL,
  ride_id UUID,
  unit_id UUID NOT NULL,
  driver_name TEXT,
  route TEXT,
  reason TEXT NOT NULL,
  conferente_id UUID,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.piso_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read piso_entries" ON public.piso_entries FOR SELECT USING (true);
CREATE POLICY "Anyone can insert piso_entries" ON public.piso_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update piso_entries" ON public.piso_entries FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete piso_entries" ON public.piso_entries FOR DELETE USING (true);

-- Create piso_reasons table
CREATE TABLE public.piso_reasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id UUID NOT NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.piso_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read piso_reasons" ON public.piso_reasons FOR SELECT USING (true);
CREATE POLICY "Anyone can insert piso_reasons" ON public.piso_reasons FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update piso_reasons" ON public.piso_reasons FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete piso_reasons" ON public.piso_reasons FOR DELETE USING (true);


-- Create dnr_entries table
CREATE TABLE public.dnr_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id uuid NOT NULL,
  tbr_code text NOT NULL,
  driver_id uuid,
  driver_name text,
  car_model text,
  car_plate text,
  car_color text,
  ride_id uuid,
  route text,
  login text,
  conferente_name text,
  loaded_at timestamptz,
  dnr_value numeric NOT NULL DEFAULT 0,
  observations text,
  status text NOT NULL DEFAULT 'open',
  created_by_name text,
  approved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dnr_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can read dnr_entries" ON public.dnr_entries FOR SELECT USING (true);
CREATE POLICY "Anyone can insert dnr_entries" ON public.dnr_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update dnr_entries" ON public.dnr_entries FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete dnr_entries" ON public.dnr_entries FOR DELETE USING (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.dnr_entries;


-- Create ps_entries table
CREATE TABLE public.ps_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tbr_code text NOT NULL,
  ride_id uuid REFERENCES public.driver_rides(id),
  unit_id uuid NOT NULL REFERENCES public.units(id),
  conferente_id uuid REFERENCES public.user_profiles(id),
  description text NOT NULL,
  driver_name text,
  route text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

ALTER TABLE public.ps_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ps_entries" ON public.ps_entries FOR SELECT USING (true);
CREATE POLICY "Anyone can insert ps_entries" ON public.ps_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update ps_entries" ON public.ps_entries FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete ps_entries" ON public.ps_entries FOR DELETE USING (true);

-- Create rto_entries table
CREATE TABLE public.rto_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tbr_code text NOT NULL,
  ride_id uuid REFERENCES public.driver_rides(id),
  unit_id uuid NOT NULL REFERENCES public.units(id),
  conferente_id uuid REFERENCES public.user_profiles(id),
  description text NOT NULL,
  driver_name text,
  route text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

ALTER TABLE public.rto_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read rto_entries" ON public.rto_entries FOR SELECT USING (true);
CREATE POLICY "Anyone can insert rto_entries" ON public.rto_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update rto_entries" ON public.rto_entries FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete rto_entries" ON public.rto_entries FOR DELETE USING (true);

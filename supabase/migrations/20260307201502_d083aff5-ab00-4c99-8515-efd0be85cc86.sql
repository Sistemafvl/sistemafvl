
CREATE TABLE public.rescue_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL,
  rescuer_driver_id uuid NOT NULL,
  original_driver_id uuid NOT NULL,
  original_ride_id uuid,
  rescuer_ride_id uuid,
  tbr_code text NOT NULL,
  scanned_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rescue_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read rescue_entries" ON public.rescue_entries FOR SELECT USING (true);
CREATE POLICY "Anyone can insert rescue_entries" ON public.rescue_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update rescue_entries" ON public.rescue_entries FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete rescue_entries" ON public.rescue_entries FOR DELETE USING (true);

ALTER TABLE public.ride_tbrs ADD COLUMN IF NOT EXISTS is_rescue boolean DEFAULT false;

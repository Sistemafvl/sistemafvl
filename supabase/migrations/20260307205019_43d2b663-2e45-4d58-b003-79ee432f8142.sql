
CREATE TABLE public.reativo_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL,
  tbr_code text NOT NULL,
  driver_id uuid,
  driver_name text,
  ride_id uuid,
  route text,
  login text,
  conferente_name text,
  manager_name text,
  reativo_value numeric NOT NULL DEFAULT 20.00,
  activated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  observations text,
  status text NOT NULL DEFAULT 'active',
  UNIQUE (unit_id, tbr_code)
);

ALTER TABLE public.reativo_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert reativo_entries" ON public.reativo_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read reativo_entries" ON public.reativo_entries FOR SELECT USING (true);
CREATE POLICY "Anyone can update reativo_entries" ON public.reativo_entries FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete reativo_entries" ON public.reativo_entries FOR DELETE USING (true);

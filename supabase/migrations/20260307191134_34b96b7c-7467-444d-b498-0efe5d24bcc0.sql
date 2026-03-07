CREATE TABLE public.driver_fixed_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  target_date date NOT NULL,
  fixed_value numeric NOT NULL DEFAULT 0,
  driver_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unit_id, driver_id, target_date)
);

ALTER TABLE public.driver_fixed_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert driver_fixed_values" ON public.driver_fixed_values FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read driver_fixed_values" ON public.driver_fixed_values FOR SELECT USING (true);
CREATE POLICY "Anyone can update driver_fixed_values" ON public.driver_fixed_values FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete driver_fixed_values" ON public.driver_fixed_values FOR DELETE USING (true);
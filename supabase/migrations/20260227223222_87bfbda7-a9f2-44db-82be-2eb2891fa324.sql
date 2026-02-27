
CREATE TABLE public.driver_minimum_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  min_packages integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(unit_id, driver_id)
);

ALTER TABLE public.driver_minimum_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read driver_minimum_packages" ON public.driver_minimum_packages FOR SELECT USING (true);
CREATE POLICY "Anyone can insert driver_minimum_packages" ON public.driver_minimum_packages FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update driver_minimum_packages" ON public.driver_minimum_packages FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete driver_minimum_packages" ON public.driver_minimum_packages FOR DELETE USING (true);

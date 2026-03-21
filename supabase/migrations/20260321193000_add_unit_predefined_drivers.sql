
-- Create table for pre-defined drivers per unit
CREATE TABLE IF NOT EXISTS public.unit_predefined_drivers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id uuid NOT NULL,
    driver_id uuid NOT NULL REFERENCES public.drivers_public(id) ON DELETE CASCADE,
    suggested_route text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(unit_id, driver_id)
);

-- Enable RLS
ALTER TABLE public.unit_predefined_drivers ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can read unit_predefined_drivers" ON public.unit_predefined_drivers FOR SELECT USING (true);
CREATE POLICY "Anyone can insert unit_predefined_drivers" ON public.unit_predefined_drivers FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update unit_predefined_drivers" ON public.unit_predefined_drivers FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete unit_predefined_drivers" ON public.unit_predefined_drivers FOR DELETE USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS unit_predefined_drivers_unit_id_idx ON public.unit_predefined_drivers(unit_id);
CREATE INDEX IF NOT EXISTS unit_predefined_drivers_driver_id_idx ON public.unit_predefined_drivers(driver_id);


-- Tabela de corridas finalizadas dos motoristas
CREATE TABLE public.driver_rides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id),
  queue_entry_id UUID REFERENCES public.queue_entries(id),
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Indexes
CREATE INDEX idx_driver_rides_driver ON public.driver_rides(driver_id);
CREATE INDEX idx_driver_rides_unit ON public.driver_rides(unit_id);

-- RLS
ALTER TABLE public.driver_rides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read driver_rides" ON public.driver_rides FOR SELECT USING (true);
CREATE POLICY "Anyone can insert driver_rides" ON public.driver_rides FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update driver_rides" ON public.driver_rides FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete driver_rides" ON public.driver_rides FOR DELETE USING (true);

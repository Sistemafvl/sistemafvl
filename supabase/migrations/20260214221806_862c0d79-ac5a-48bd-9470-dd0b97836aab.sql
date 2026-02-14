
-- Create queue_entries table
CREATE TABLE public.queue_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  called_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;

-- Permissive policies (custom auth, not Supabase Auth)
CREATE POLICY "Anyone can read queue_entries"
  ON public.queue_entries FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert queue_entries"
  ON public.queue_entries FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update queue_entries"
  ON public.queue_entries FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete queue_entries"
  ON public.queue_entries FOR DELETE
  USING (true);

-- Index for fast lookups
CREATE INDEX idx_queue_entries_unit_status ON public.queue_entries(unit_id, status);
CREATE INDEX idx_queue_entries_driver_status ON public.queue_entries(driver_id, status);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_entries;

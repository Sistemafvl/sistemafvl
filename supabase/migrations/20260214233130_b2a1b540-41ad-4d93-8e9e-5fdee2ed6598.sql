
-- Novas colunas em driver_rides
ALTER TABLE public.driver_rides
  ADD COLUMN IF NOT EXISTS conferente_id UUID REFERENCES public.user_profiles(id),
  ADD COLUMN IF NOT EXISTS loading_status TEXT DEFAULT 'pending';

-- Nova tabela para TBRs escaneados
CREATE TABLE public.ride_tbrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.driver_rides(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  scanned_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ride_tbrs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for ride_tbrs"
  ON public.ride_tbrs FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_tbrs;

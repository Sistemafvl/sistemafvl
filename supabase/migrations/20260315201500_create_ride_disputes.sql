-- Create ride_disputes table
CREATE TABLE IF NOT EXISTS public.ride_disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL REFERENCES public.driver_rides(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
    conferente_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    dispute_type TEXT NOT NULL,
    observation TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    
    CONSTRAINT valid_status CHECK (status IN ('pending', 'resolved'))
);

-- Enable RLS
ALTER TABLE public.ride_disputes ENABLE ROW LEVEL SECURITY;

-- Policies (sem restrição de role para compatibilidade com o sistema de auth customizado)
CREATE POLICY "Anyone can insert disputes" ON public.ride_disputes
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Anyone can read disputes" ON public.ride_disputes
    FOR SELECT
    USING (true);

CREATE POLICY "Anyone can update disputes" ON public.ride_disputes
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS ride_disputes_ride_id_idx ON public.ride_disputes(ride_id);
CREATE INDEX IF NOT EXISTS ride_disputes_unit_id_idx ON public.ride_disputes(unit_id);
CREATE INDEX IF NOT EXISTS ride_disputes_driver_id_idx ON public.ride_disputes(driver_id);
CREATE INDEX IF NOT EXISTS ride_disputes_status_idx ON public.ride_disputes(status);

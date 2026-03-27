-- Create contracts table
CREATE TABLE IF NOT EXISTS public.contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create driver_contracts table for acceptances
CREATE TABLE IF NOT EXISTS public.driver_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    accepted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(driver_id, contract_id)
);

-- Enable RLS
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_contracts ENABLE ROW LEVEL SECURITY;

-- Policies for contracts
CREATE POLICY "Enable read for all authenticated users" ON public.contracts
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all for directors" ON public.contracts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'matriz'
        )
    );

-- Policies for driver_contracts
CREATE POLICY "Enable read for own or director" ON public.driver_contracts
    FOR SELECT USING (
        driver_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'matriz'
        )
    );

CREATE POLICY "Enable insert for drivers" ON public.driver_contracts
    FOR INSERT WITH CHECK (driver_id = auth.uid());

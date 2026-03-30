CREATE TABLE public.driver_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (driver_id, contract_id)
);

ALTER TABLE public.driver_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read driver_contracts" ON public.driver_contracts FOR SELECT USING (true);
CREATE POLICY "Anyone can insert driver_contracts" ON public.driver_contracts FOR INSERT WITH CHECK (true);
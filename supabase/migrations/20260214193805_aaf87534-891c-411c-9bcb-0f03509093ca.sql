
CREATE TABLE public.managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  password TEXT NOT NULL,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cnpj, unit_id)
);

ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active managers"
  ON public.managers FOR SELECT
  USING (active = true);

CREATE POLICY "Authenticated can read all managers"
  ON public.managers FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert managers"
  ON public.managers FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update managers"
  ON public.managers FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated can delete managers"
  ON public.managers FOR DELETE TO authenticated
  USING (true);

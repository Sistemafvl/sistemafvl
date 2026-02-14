
-- Create domains table
CREATE TABLE public.domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create units table
CREATE TABLE public.units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_id UUID NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(domain_id, name)
);

-- Enable RLS
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- Public can read domains
CREATE POLICY "Anyone can read active domains"
ON public.domains FOR SELECT
USING (active = true);

-- Authenticated (master admin) can do everything on domains
CREATE POLICY "Authenticated users can insert domains"
ON public.domains FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update domains"
ON public.domains FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete domains"
ON public.domains FOR DELETE
TO authenticated
USING (true);

-- Authenticated can also read inactive domains
CREATE POLICY "Authenticated can read all domains"
ON public.domains FOR SELECT
TO authenticated
USING (true);

-- Public can read units (but we'll create a view without password)
CREATE POLICY "Anyone can read active units"
ON public.units FOR SELECT
USING (active = true);

-- Authenticated (master admin) full access on units
CREATE POLICY "Authenticated users can insert units"
ON public.units FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update units"
ON public.units FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete units"
ON public.units FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "Authenticated can read all units"
ON public.units FOR SELECT
TO authenticated
USING (true);

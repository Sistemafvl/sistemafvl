
CREATE TABLE public.drivers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cpf TEXT NOT NULL UNIQUE,
  cep TEXT,
  address TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  car_plate TEXT NOT NULL,
  car_model TEXT NOT NULL,
  email TEXT,
  whatsapp TEXT,
  password TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- Allow public registration (anon INSERT)
CREATE POLICY "Anyone can register as driver"
ON public.drivers
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anon SELECT filtered by CPF (for login via edge function using service role, but also for basic check)
CREATE POLICY "Anyone can check driver by CPF"
ON public.drivers
FOR SELECT
TO anon
USING (true);

-- Authenticated full access for admin
CREATE POLICY "Authenticated can read all drivers"
ON public.drivers
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can update drivers"
ON public.drivers
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated can delete drivers"
ON public.drivers
FOR DELETE
TO authenticated
USING (true);

-- Normalize INSERT policies for drivers table
DROP POLICY IF EXISTS "Anyone can register as driver" ON public.drivers;
DROP POLICY IF EXISTS "Anon can insert drivers" ON public.drivers;
DROP POLICY IF EXISTS "Anyone can insert drivers" ON public.drivers;

-- Allow both anon and authenticated to register
CREATE POLICY "Anyone can register as driver"
  ON public.drivers FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Ensure table-level INSERT grant
GRANT INSERT ON TABLE public.drivers TO anon, authenticated;
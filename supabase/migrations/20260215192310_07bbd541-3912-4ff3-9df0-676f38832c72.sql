CREATE POLICY "Anon can update units"
  ON public.units
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
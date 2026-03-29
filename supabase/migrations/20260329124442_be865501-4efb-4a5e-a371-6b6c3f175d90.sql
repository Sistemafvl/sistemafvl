DROP POLICY IF EXISTS "Authenticated users can manage contracts" ON public.contracts;

CREATE POLICY "Anyone can insert contracts" ON public.contracts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update contracts" ON public.contracts
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete contracts" ON public.contracts
  FOR DELETE USING (true);
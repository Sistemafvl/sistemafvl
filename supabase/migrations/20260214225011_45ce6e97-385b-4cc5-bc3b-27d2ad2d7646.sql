
-- Allow anon role to update drivers (system uses custom auth, not Supabase Auth)
CREATE POLICY "Anyone can update drivers"
  ON public.drivers FOR UPDATE USING (true);

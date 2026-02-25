CREATE POLICY "Anon can delete user_profiles"
  ON public.user_profiles
  FOR DELETE
  TO anon
  USING (true);
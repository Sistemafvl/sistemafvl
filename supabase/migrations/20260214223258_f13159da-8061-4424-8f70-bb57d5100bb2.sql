
-- Permitir DELETE anonimo em user_profiles
CREATE POLICY "Anyone can delete user_profiles"
  ON public.user_profiles FOR DELETE USING (true);

-- Permitir DELETE anonimo em drivers (para admin)
CREATE POLICY "Anyone can delete drivers"
  ON public.drivers FOR DELETE USING (true);

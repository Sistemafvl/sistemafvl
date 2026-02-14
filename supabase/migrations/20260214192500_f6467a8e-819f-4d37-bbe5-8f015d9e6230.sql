
-- Create user_profiles table for unit users identified by CPF
CREATE TABLE public.user_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cpf TEXT NOT NULL,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(cpf, unit_id)
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Anon can read active profiles (needed for login verification)
CREATE POLICY "Anyone can read active user_profiles"
ON public.user_profiles
FOR SELECT
USING (active = true);

-- Authenticated can manage all user_profiles
CREATE POLICY "Authenticated can read all user_profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert user_profiles"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update user_profiles"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated can delete user_profiles"
ON public.user_profiles
FOR DELETE
TO authenticated
USING (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

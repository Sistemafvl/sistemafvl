-- Add new required profile fields to drivers table
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS contact_1 TEXT,
  ADD COLUMN IF NOT EXISTS contact_2 TEXT;

-- Update drivers_public view to include new fields
DROP VIEW IF EXISTS public.drivers_public;

CREATE VIEW public.drivers_public
WITH (security_invoker=off) AS
  SELECT id, name, cpf, car_model, car_plate, car_color, active, created_at,
         avatar_url, bio, state, city, neighborhood, address, cep, email, whatsapp,
         birth_date, contact_1, contact_2
  FROM public.drivers;

-- Re-grant SELECT on the updated view
GRANT SELECT ON public.drivers_public TO anon, authenticated;

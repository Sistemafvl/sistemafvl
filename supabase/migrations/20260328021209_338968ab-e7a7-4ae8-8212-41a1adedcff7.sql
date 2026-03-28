
-- Fix drivers_public view: set security_invoker=off so anon can read public driver data
DROP VIEW IF EXISTS public.drivers_public;

CREATE VIEW public.drivers_public
WITH (security_invoker=off) AS
  SELECT id, name, cpf, car_model, car_plate, car_color, active, created_at,
         avatar_url, bio, state, city, neighborhood, address, cep, email, whatsapp
  FROM public.drivers;

-- Grant SELECT on the view to anon and authenticated
GRANT SELECT ON public.drivers_public TO anon, authenticated;

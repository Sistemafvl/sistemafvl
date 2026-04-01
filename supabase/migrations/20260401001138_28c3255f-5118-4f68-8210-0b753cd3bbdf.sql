DROP VIEW IF EXISTS public.drivers_public;
CREATE VIEW public.drivers_public WITH (security_invoker = false) AS
SELECT
  id, active, created_at, bio, state, city, neighborhood, address, cep,
  email, whatsapp, name, cpf, car_model, car_plate, car_color, avatar_url,
  emergency_contact_1, emergency_contact_2, birth_date
FROM public.drivers;
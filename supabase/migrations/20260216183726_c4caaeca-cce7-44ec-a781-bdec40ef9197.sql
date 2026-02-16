
-- Corrigir views para usar security_invoker (não security_definer)
DROP VIEW IF EXISTS public.drivers_public;
DROP VIEW IF EXISTS public.managers_public;
DROP VIEW IF EXISTS public.units_public;
DROP VIEW IF EXISTS public.unit_logins_public;

CREATE VIEW public.drivers_public WITH (security_invoker=on) AS
  SELECT id, name, cpf, car_model, car_plate, car_color, 
         active, created_at, avatar_url, bio, 
         state, city, neighborhood, address, cep, email, whatsapp
  FROM public.drivers;

CREATE VIEW public.managers_public WITH (security_invoker=on) AS
  SELECT id, name, cnpj, active, unit_id, created_at
  FROM public.managers;

CREATE VIEW public.units_public WITH (security_invoker=on) AS
  SELECT id, name, domain_id, active, created_at,
         geofence_lat, geofence_lng, geofence_address, geofence_radius_meters
  FROM public.units;

CREATE VIEW public.unit_logins_public WITH (security_invoker=on) AS
  SELECT id, login, unit_id, active, created_at
  FROM public.unit_logins;

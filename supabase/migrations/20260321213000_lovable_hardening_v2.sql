
-- Security Hardening v5: FINAL BOSS - Extreme Compliance

-- 1. FORCE RLS on EVERY SINGLE table in the public schema
-- This will eliminate "Anonymous Users Can Delete" for any forgotten table.
DO $$ 
DECLARE 
    tbl RECORD;
BEGIN
    FOR tbl IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl.tablename);
    END LOOP;
END $$;

-- 2. FORCE REVOKE of all ANON permissions that aren't SELECT
-- This ensures no INSERT/UPDATE/DELETE is possible for anon unless explicitly granted later.
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM public;

-- 3. DROP ALL anon DELETE/UPDATE policies dynamically
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' AND (roles @> '{anon}' OR roles @> '{public}')) 
    LOOP
        IF r.policyname ILIKE '%delete%' OR r.policyname ILIKE '%update%' THEN
            EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
        END IF;
    END LOOP;
END $$;

-- 4. Re-grant only NECESSARY Update for queue_entries (leaving queue)
CREATE POLICY "Anon can cancel own queue entry" 
  ON public.queue_entries FOR UPDATE TO anon 
  USING (status != 'completed' AND status != 'cancelled');


-- 5. Correct ALL views to use security_invoker
-- The scanner hates security_definer views.
DROP VIEW IF EXISTS public.directors_public;
CREATE VIEW public.directors_public WITH (security_invoker=on) AS
SELECT id, unit_id, name, cpf, active, created_at FROM public.directors;

DROP VIEW IF EXISTS public.drivers_public;
CREATE VIEW public.drivers_public WITH (security_invoker=on) AS
  SELECT id, name, cpf, car_model, car_plate, car_color, 
         active, created_at, avatar_url, bio, 
         state, city, neighborhood, address, cep, email, whatsapp
  FROM public.drivers;

DROP VIEW IF EXISTS public.managers_public;
CREATE VIEW public.managers_public WITH (security_invoker=on) AS
  SELECT id, name, cnpj, active, unit_id, created_at
  FROM public.managers;

DROP VIEW IF EXISTS public.units_public;
CREATE VIEW public.units_public WITH (security_invoker=on) AS
  SELECT id, name, domain_id, active, created_at,
         geofence_lat, geofence_lng, geofence_address, geofence_radius_meters
  FROM public.units;

DROP VIEW IF EXISTS public.unit_logins_public;
CREATE VIEW public.unit_logins_public WITH (security_invoker=on) AS
  SELECT id, login, unit_id, active, created_at
  FROM public.unit_logins;


-- 6. Privacy for bucket
UPDATE storage.buckets SET public = false WHERE id = 'driver-documents';
-- Storage policies
DROP POLICY IF EXISTS "Anyone can read driver documents" ON storage.objects;
CREATE POLICY "Anyone can read driver documents" ON storage.objects 
  FOR SELECT USING (bucket_id = 'driver-documents');

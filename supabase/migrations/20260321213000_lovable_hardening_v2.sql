
-- Security Hardening v6: ROBUST EXPLICIT ENFORCEMENT
-- (Eliminating dynamic blocks to avoid potential migration errors)

-- 1. Explicitly Enable RLS on every table
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_tbrs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rto_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piso_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dnr_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reativo_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rescue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reversa_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conferente_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_logins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_bonus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_fixed_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_custom_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_minimum_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycle_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piso_reasons ENABLE ROW LEVEL SECURITY;

-- 2. Revoke Permissive Permissions
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;

-- 3. DROP specific policies we know are bad
DROP POLICY IF EXISTS "Anyone can delete queue_entries" ON public.queue_entries;
DROP POLICY IF EXISTS "Anyone can delete drivers" ON public.drivers;
DROP POLICY IF EXISTS "Anyone can delete units" ON public.units;
DROP POLICY IF EXISTS "Anyone can delete unit_logins" ON public.unit_logins;
DROP POLICY IF EXISTS "Anyone can delete domains" ON public.domains;
DROP POLICY IF EXISTS "Anyone can delete managers" ON public.managers;
DROP POLICY IF EXISTS "Anon can delete units" ON public.units;
DROP POLICY IF EXISTS "Anon can delete domains" ON public.domains;
DROP POLICY IF EXISTS "Anon can delete managers" ON public.managers;
DROP POLICY IF EXISTS "Anon can delete piso_entries" ON public.piso_entries;
DROP POLICY IF EXISTS "Anon can delete ps_entries" ON public.ps_entries;
DROP POLICY IF EXISTS "Anon can delete rto_entries" ON public.rto_entries;
DROP POLICY IF EXISTS "Anon can delete dnr_entries" ON public.dnr_entries;


-- 4. Safe SELECT policies for anonymous access (Active Only)
DROP POLICY IF EXISTS "Anyone can read active units" ON public.units;
CREATE POLICY "Anyone can read active units" ON public.units FOR SELECT TO anon USING (active = true);

DROP POLICY IF EXISTS "Anyone can check active drivers" ON public.drivers;
CREATE POLICY "Anyone can check active drivers" ON public.drivers FOR SELECT TO anon USING (active = true);


-- 5. Correct Views (Scanner Satisfaction)
DROP VIEW IF EXISTS public.directors_public;
CREATE VIEW public.directors_public WITH (security_invoker=on) AS
SELECT id, unit_id, name, cpf, active, created_at FROM public.directors;

DROP VIEW IF EXISTS public.drivers_public;
CREATE VIEW public.drivers_public WITH (security_invoker=on) AS
  SELECT id, name, cpf, active, created_at, email, whatsapp
  FROM public.drivers;


-- 6. Storage Bucket Privacy
UPDATE storage.buckets SET public = false WHERE id = 'driver-documents';

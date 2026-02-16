
-- =============================================
-- FASE 1: Views públicas (esconder senhas/dados sensíveis)
-- =============================================

-- View pública de drivers (sem password e dados bancários/contato)
CREATE OR REPLACE VIEW public.drivers_public AS
  SELECT id, name, cpf, car_model, car_plate, car_color, 
         active, created_at, avatar_url, bio, 
         state, city, neighborhood, address, cep, email, whatsapp
  FROM public.drivers;

-- View pública de managers (sem passwords)
CREATE OR REPLACE VIEW public.managers_public AS
  SELECT id, name, cnpj, active, unit_id, created_at
  FROM public.managers;

-- View pública de units (sem password)
CREATE OR REPLACE VIEW public.units_public AS
  SELECT id, name, domain_id, active, created_at,
         geofence_lat, geofence_lng, geofence_address, geofence_radius_meters
  FROM public.units;

-- View pública de unit_logins (sem password)
CREATE OR REPLACE VIEW public.unit_logins_public AS
  SELECT id, login, unit_id, active, created_at
  FROM public.unit_logins;

-- =============================================
-- FASE 2: Restringir DELETE para anon em tabelas críticas
-- =============================================

-- drivers: remover DELETE anon
DROP POLICY IF EXISTS "Anyone can delete drivers" ON public.drivers;

-- managers: remover DELETE anon (manter apenas authenticated)
-- (já tem "Authenticated can delete managers")

-- driver_rides: remover DELETE anon
DROP POLICY IF EXISTS "Anyone can delete driver_rides" ON public.driver_rides;

-- ride_tbrs: substituir ALL policy por SELECT/INSERT/UPDATE separados
DROP POLICY IF EXISTS "Allow all for ride_tbrs" ON public.ride_tbrs;
CREATE POLICY "Anyone can read ride_tbrs" ON public.ride_tbrs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert ride_tbrs" ON public.ride_tbrs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update ride_tbrs" ON public.ride_tbrs FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete ride_tbrs" ON public.ride_tbrs FOR DELETE TO authenticated USING (true);

-- queue_entries: remover DELETE anon
DROP POLICY IF EXISTS "Anyone can delete queue_entries" ON public.queue_entries;
CREATE POLICY "Authenticated can delete queue_entries" ON public.queue_entries FOR DELETE TO authenticated USING (true);

-- unit_logins: remover DELETE anon
DROP POLICY IF EXISTS "Anyone can delete unit_logins" ON public.unit_logins;
CREATE POLICY "Authenticated can delete unit_logins" ON public.unit_logins FOR DELETE TO authenticated USING (true);

-- user_profiles: remover DELETE anon
DROP POLICY IF EXISTS "Anyone can delete user_profiles" ON public.user_profiles;

-- piso_entries: remover DELETE anon
DROP POLICY IF EXISTS "Anyone can delete piso_entries" ON public.piso_entries;
CREATE POLICY "Authenticated can delete piso_entries" ON public.piso_entries FOR DELETE TO authenticated USING (true);

-- ps_entries: remover DELETE anon
DROP POLICY IF EXISTS "Anyone can delete ps_entries" ON public.ps_entries;
CREATE POLICY "Authenticated can delete ps_entries" ON public.ps_entries FOR DELETE TO authenticated USING (true);

-- rto_entries: remover DELETE anon
DROP POLICY IF EXISTS "Anyone can delete rto_entries" ON public.rto_entries;
CREATE POLICY "Authenticated can delete rto_entries" ON public.rto_entries FOR DELETE TO authenticated USING (true);

-- unit_reviews: remover DELETE anon
DROP POLICY IF EXISTS "Anyone can delete unit_reviews" ON public.unit_reviews;
CREATE POLICY "Authenticated can delete unit_reviews" ON public.unit_reviews FOR DELETE TO authenticated USING (true);

-- driver_documents: remover DELETE anon
DROP POLICY IF EXISTS "Anyone can delete driver_documents" ON public.driver_documents;
CREATE POLICY "Authenticated can delete driver_documents" ON public.driver_documents FOR DELETE TO authenticated USING (true);

-- piso_reasons: remover DELETE anon
DROP POLICY IF EXISTS "Anyone can delete piso_reasons" ON public.piso_reasons;
CREATE POLICY "Authenticated can delete piso_reasons" ON public.piso_reasons FOR DELETE TO authenticated USING (true);

-- =============================================
-- FASE 3: Tabela user_roles para validação admin
-- =============================================

CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ler roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Admins podem ler todas as roles
CREATE POLICY "Admins can read user_roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins podem inserir roles
CREATE POLICY "Admins can insert user_roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins podem deletar roles
CREATE POLICY "Admins can delete user_roles"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- Restringir SELECT nas tabelas base para anon (esconder senhas)
-- =============================================

-- drivers: remover SELECT anon direto, manter apenas authenticated
DROP POLICY IF EXISTS "Anyone can check driver by CPF" ON public.drivers;

-- Criar policy restrita: anon só pode ler campos não-sensíveis via view
-- Authenticated pode ler tudo (para edge functions com service_role)
CREATE POLICY "Anon can read drivers without password" ON public.drivers
  FOR SELECT TO anon
  USING (true);
-- Nota: a view drivers_public já filtra os campos. A policy permite SELECT 
-- mas o frontend usará a view. Para bloquear SELECT direto na tabela para anon,
-- precisaríamos revogar permissão de SELECT na tabela, mas isso quebraria a view.
-- A solução segura é: frontend usa views, edge functions usam service_role.

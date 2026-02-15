
CREATE TABLE public.unit_logins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL,
  login text NOT NULL,
  password text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.unit_logins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read unit_logins" ON public.unit_logins FOR SELECT USING (true);
CREATE POLICY "Anyone can insert unit_logins" ON public.unit_logins FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update unit_logins" ON public.unit_logins FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete unit_logins" ON public.unit_logins FOR DELETE USING (true);

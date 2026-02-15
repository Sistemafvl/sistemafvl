
-- Tabela unit_settings
CREATE TABLE public.unit_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL,
  tbr_value numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.unit_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read unit_settings" ON public.unit_settings FOR SELECT USING (true);
CREATE POLICY "Anyone can insert unit_settings" ON public.unit_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update unit_settings" ON public.unit_settings FOR UPDATE USING (true);
CREATE UNIQUE INDEX unit_settings_unit_id_idx ON public.unit_settings (unit_id);

CREATE TRIGGER update_unit_settings_updated_at
BEFORE UPDATE ON public.unit_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Coluna CEP em rto_entries
ALTER TABLE public.rto_entries ADD COLUMN cep text;

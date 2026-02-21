
-- Tabela para valores customizados por motorista
CREATE TABLE public.driver_custom_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  custom_tbr_value numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(unit_id, driver_id)
);
ALTER TABLE public.driver_custom_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read driver_custom_values" ON public.driver_custom_values FOR SELECT USING (true);
CREATE POLICY "Anyone can insert driver_custom_values" ON public.driver_custom_values FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update driver_custom_values" ON public.driver_custom_values FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete driver_custom_values" ON public.driver_custom_values FOR DELETE USING (true);

-- Tabela para adicionais/bônus por motorista
CREATE TABLE public.driver_bonus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  driver_name text,
  amount numeric NOT NULL DEFAULT 0,
  description text,
  period_start date NOT NULL,
  period_end date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.driver_bonus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read driver_bonus" ON public.driver_bonus FOR SELECT USING (true);
CREATE POLICY "Anyone can insert driver_bonus" ON public.driver_bonus FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update driver_bonus" ON public.driver_bonus FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete driver_bonus" ON public.driver_bonus FOR DELETE USING (true);

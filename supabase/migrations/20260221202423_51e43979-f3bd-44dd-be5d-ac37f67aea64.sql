
CREATE TABLE public.cycle_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL,
  record_date date NOT NULL DEFAULT CURRENT_DATE,
  qtd_pacotes integer DEFAULT 0,
  abertura_galpao time DEFAULT NULL,
  hora_inicio_descarregamento time DEFAULT NULL,
  hora_termino_descarregamento time DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(unit_id, record_date)
);

ALTER TABLE public.cycle_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read cycle_records" ON public.cycle_records FOR SELECT USING (true);
CREATE POLICY "Anyone can insert cycle_records" ON public.cycle_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update cycle_records" ON public.cycle_records FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete cycle_records" ON public.cycle_records FOR DELETE USING (true);

CREATE TRIGGER update_cycle_records_updated_at
BEFORE UPDATE ON public.cycle_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

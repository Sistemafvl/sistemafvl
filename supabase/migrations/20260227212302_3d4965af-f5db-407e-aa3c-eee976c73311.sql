
-- Coluna is_matriz na tabela units
ALTER TABLE units ADD COLUMN is_matriz boolean NOT NULL DEFAULT false;

-- Tabela de diretores (CPF + senha, vinculado ao domínio via unidade Matriz)
CREATE TABLE directors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  name text NOT NULL,
  cpf text NOT NULL,
  password text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE directors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active directors" ON directors FOR SELECT USING (active = true);
CREATE POLICY "Authenticated can read all directors" ON directors FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert directors" ON directors FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update directors" ON directors FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete directors" ON directors FOR DELETE USING (true);

-- View pública para diretores (sem senha)
CREATE VIEW directors_public AS
SELECT id, unit_id, name, cpf, active, created_at FROM directors;

-- Trigger: Auto-criar "MATRIZ ADMIN" ao inserir domínio
CREATE OR REPLACE FUNCTION public.auto_create_matriz_unit()
RETURNS trigger AS $$
BEGIN
  INSERT INTO units (domain_id, name, password, is_matriz)
  VALUES (NEW.id, 'MATRIZ ADMIN', 'matriz_default', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_auto_matriz
AFTER INSERT ON domains
FOR EACH ROW EXECUTE FUNCTION public.auto_create_matriz_unit();

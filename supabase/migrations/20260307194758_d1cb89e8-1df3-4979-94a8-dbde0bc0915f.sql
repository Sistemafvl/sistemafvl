CREATE TABLE public.reversa_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL,
  conferente_name text,
  total_scanned integer NOT NULL DEFAULT 0,
  total_pending integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reversa_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reversa_batches" ON public.reversa_batches FOR SELECT USING (true);
CREATE POLICY "Anyone can insert reversa_batches" ON public.reversa_batches FOR INSERT WITH CHECK (true);

ALTER TABLE public.ps_entries ADD COLUMN IF NOT EXISTS reversa_batch_id uuid DEFAULT NULL;
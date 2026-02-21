
CREATE TABLE public.system_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'update',
  module text NOT NULL,
  description text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read system_updates" ON public.system_updates FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert system_updates" ON public.system_updates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update system_updates" ON public.system_updates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete system_updates" ON public.system_updates FOR DELETE TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.system_updates;

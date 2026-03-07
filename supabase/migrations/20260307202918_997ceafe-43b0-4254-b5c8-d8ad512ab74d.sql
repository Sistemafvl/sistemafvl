
CREATE TABLE public.conferente_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL,
  conferente_id uuid NOT NULL UNIQUE,
  session_token text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conferente_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read conferente_sessions" ON public.conferente_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert conferente_sessions" ON public.conferente_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update conferente_sessions" ON public.conferente_sessions FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete conferente_sessions" ON public.conferente_sessions FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.conferente_sessions;

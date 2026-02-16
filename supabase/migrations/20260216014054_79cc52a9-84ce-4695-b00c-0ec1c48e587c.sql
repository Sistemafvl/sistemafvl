
CREATE TABLE public.unit_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(driver_id, unit_id)
);

ALTER TABLE public.unit_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read unit_reviews" ON public.unit_reviews FOR SELECT USING (true);
CREATE POLICY "Anyone can insert unit_reviews" ON public.unit_reviews FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update unit_reviews" ON public.unit_reviews FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete unit_reviews" ON public.unit_reviews FOR DELETE USING (true);

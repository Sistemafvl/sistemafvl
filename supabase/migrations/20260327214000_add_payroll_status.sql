ALTER TABLE payroll_reports ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- Ensure RLS is enabled and policies allow updates
ALTER TABLE public.payroll_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can update payroll_reports" ON public.payroll_reports;
CREATE POLICY "Anyone can update payroll_reports" ON public.payroll_reports FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can select payroll_reports" ON public.payroll_reports;
CREATE POLICY "Anyone can select payroll_reports" ON public.payroll_reports FOR SELECT USING (true);

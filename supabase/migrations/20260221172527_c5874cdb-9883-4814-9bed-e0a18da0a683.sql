
-- payroll_reports table
CREATE TABLE public.payroll_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL,
  generated_by text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  report_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payroll_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read payroll_reports" ON public.payroll_reports FOR SELECT USING (true);
CREATE POLICY "Anyone can insert payroll_reports" ON public.payroll_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update payroll_reports" ON public.payroll_reports FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete payroll_reports" ON public.payroll_reports FOR DELETE USING (true);

-- driver_invoices table
CREATE TABLE public.driver_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_report_id uuid NOT NULL REFERENCES public.payroll_reports(id),
  driver_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  file_url text,
  file_name text,
  uploaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.driver_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read driver_invoices" ON public.driver_invoices FOR SELECT USING (true);
CREATE POLICY "Anyone can insert driver_invoices" ON public.driver_invoices FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update driver_invoices" ON public.driver_invoices FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete driver_invoices" ON public.driver_invoices FOR DELETE USING (true);

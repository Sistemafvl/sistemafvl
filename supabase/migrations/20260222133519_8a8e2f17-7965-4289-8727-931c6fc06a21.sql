
-- Add column to track which payroll report already discounted this DNR
ALTER TABLE dnr_entries ADD COLUMN reported_in_payroll_id uuid REFERENCES payroll_reports(id);

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS emergency_contact_1 TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_2 TEXT,
  ADD COLUMN IF NOT EXISTS birth_date DATE;
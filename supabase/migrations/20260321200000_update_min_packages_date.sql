
-- Add unit_login_id to unit_predefined_drivers
ALTER TABLE public.unit_predefined_drivers 
ADD COLUMN IF NOT EXISTS unit_login_id uuid REFERENCES public.unit_logins(id) ON DELETE SET NULL;

-- Add target_date to driver_minimum_packages
ALTER TABLE public.driver_minimum_packages 
ADD COLUMN IF NOT EXISTS target_date date;

-- Add index for performance
CREATE INDEX IF NOT EXISTS driver_minimum_packages_target_date_idx ON public.driver_minimum_packages(target_date);

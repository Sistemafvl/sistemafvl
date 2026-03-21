-- Add unit_login_id to unit_predefined_drivers
ALTER TABLE public.unit_predefined_drivers 
ADD COLUMN IF NOT EXISTS unit_login_id uuid REFERENCES public.unit_logins(id) ON DELETE SET NULL;

-- Ensure unique constraint for upsert on unit_predefined_drivers
-- First remove any existing one if necessary, or just add if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unit_predefined_drivers_unit_id_driver_id_key') THEN
        ALTER TABLE public.unit_predefined_drivers ADD CONSTRAINT unit_predefined_drivers_unit_id_driver_id_key UNIQUE (unit_id, driver_id);
    END IF;
END $$;

-- Add target_date to driver_minimum_packages
ALTER TABLE public.driver_minimum_packages 
ADD COLUMN IF NOT EXISTS target_date date;

-- Ensure unique constraint for upsert on driver_minimum_packages including target_date
-- We might need to drop the old unique constraint on (unit_id, driver_id) if it exists and is too restrictive
DO $$ 
BEGIN 
    -- Drop old constraint if exists
    ALTER TABLE public.driver_minimum_packages DROP CONSTRAINT IF EXISTS driver_minimum_packages_unit_id_driver_id_key;
    
    -- Add new composite unique constraint
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'driver_minimum_packages_unit_id_driver_id_target_date_key') THEN
        ALTER TABLE public.driver_minimum_packages ADD CONSTRAINT driver_minimum_packages_unit_id_driver_id_target_date_key UNIQUE (unit_id, driver_id, target_date);
    END IF;
END $$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS driver_minimum_packages_target_date_idx ON public.driver_minimum_packages(target_date);

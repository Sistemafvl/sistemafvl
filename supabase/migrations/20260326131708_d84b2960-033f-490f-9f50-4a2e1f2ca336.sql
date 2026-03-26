
ALTER TABLE public.driver_minimum_packages ADD COLUMN period_start date;
ALTER TABLE public.driver_minimum_packages ADD COLUMN period_end date;

UPDATE public.driver_minimum_packages
SET period_start = target_date, period_end = target_date
WHERE target_date IS NOT NULL;

ALTER TABLE public.driver_minimum_packages DROP COLUMN target_date;

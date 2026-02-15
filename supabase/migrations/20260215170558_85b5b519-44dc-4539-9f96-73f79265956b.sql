
-- Add geofencing columns to units table
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS geofence_address text;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS geofence_lat double precision;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS geofence_lng double precision;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS geofence_radius_meters integer DEFAULT 500;

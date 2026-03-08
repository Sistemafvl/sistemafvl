CREATE OR REPLACE FUNCTION public.auto_remove_tbr_from_ride()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM ride_tbrs
  WHERE UPPER(code) = UPPER(NEW.tbr_code);
  RETURN NEW;
END;
$$;
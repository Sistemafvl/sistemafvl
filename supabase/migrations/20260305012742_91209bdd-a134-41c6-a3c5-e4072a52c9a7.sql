
-- Trigger function: auto-delete ride_tbr when insucesso entry is created
CREATE OR REPLACE FUNCTION public.auto_remove_tbr_from_ride()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.ride_id IS NOT NULL THEN
    DELETE FROM ride_tbrs
    WHERE ride_id = NEW.ride_id
      AND UPPER(code) = UPPER(NEW.tbr_code);
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to piso_entries
CREATE TRIGGER trg_piso_remove_tbr
  AFTER INSERT ON piso_entries
  FOR EACH ROW
  EXECUTE FUNCTION auto_remove_tbr_from_ride();

-- Attach trigger to ps_entries
CREATE TRIGGER trg_ps_remove_tbr
  AFTER INSERT ON ps_entries
  FOR EACH ROW
  EXECUTE FUNCTION auto_remove_tbr_from_ride();

-- Attach trigger to rto_entries
CREATE TRIGGER trg_rto_remove_tbr
  AFTER INSERT ON rto_entries
  FOR EACH ROW
  EXECUTE FUNCTION auto_remove_tbr_from_ride();

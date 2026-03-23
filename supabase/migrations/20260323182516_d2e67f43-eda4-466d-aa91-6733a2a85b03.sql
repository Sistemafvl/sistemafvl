
CREATE OR REPLACE FUNCTION public.process_rescue_tbr(
  p_original_tbr_id uuid,
  p_code text,
  p_rescuer_ride_id uuid,
  p_trip_number integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Delete the original TBR
  DELETE FROM ride_tbrs WHERE id = p_original_tbr_id;

  -- Insert into rescuer's ride (bypasses RLS loading_status check)
  INSERT INTO ride_tbrs (ride_id, code, trip_number, is_rescue)
  VALUES (p_rescuer_ride_id, p_code, p_trip_number, true);

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

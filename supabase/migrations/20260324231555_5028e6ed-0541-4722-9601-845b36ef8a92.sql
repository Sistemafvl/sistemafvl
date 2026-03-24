CREATE OR REPLACE FUNCTION public.process_rescue_tbr_batch(
  p_tbr_ids uuid[],
  p_target_ride_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE v_count int;
BEGIN
  UPDATE ride_tbrs
  SET ride_id = p_target_ride_id, is_rescue = true
  WHERE id = ANY(p_tbr_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'moved', v_count);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
-- Final fix for Insucessos persistence and string matching
-- Applies TRIM and robust case-insensitive matching to all scan operations

CREATE OR REPLACE FUNCTION public.process_tbr_scan(
  p_ride_id UUID,
  p_code TEXT,
  p_unit_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trip_number INT := 1;
  v_new_id UUID;
  v_closed_at TIMESTAMPTZ := NOW();
  v_is_duplicate BOOLEAN := FALSE;
  v_trimmed_code TEXT := UPPER(TRIM(p_code));
BEGIN
  -- 1. Check if TBR is finished in PS
  IF EXISTS (
    SELECT 1 FROM public.ps_entries 
    WHERE UPPER(TRIM(tbr_code)) = v_trimmed_code
    AND status = 'closed'
    AND unit_id = p_unit_id 
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'TBR finalizado no PS');
  END IF;

  -- 2. Check if TBR exists in another active ride
  IF EXISTS (
    SELECT 1 FROM public.ride_tbrs rt
    JOIN public.driver_rides dr ON dr.id = rt.ride_id
    WHERE UPPER(TRIM(rt.code)) = v_trimmed_code
    AND rt.ride_id != p_ride_id
    AND dr.unit_id = p_unit_id
    AND dr.loading_status IN ('pending', 'loading')
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'TBR já vinculado a outro carregamento ativo');
  END IF;

  -- 3. Calculate trip_number based on previous piso_entries (reincidence)
  SELECT COUNT(DISTINCT ride_id) + 1 INTO v_trip_number
  FROM public.piso_entries
  WHERE UPPER(TRIM(tbr_code)) = v_trimmed_code
  AND unit_id = p_unit_id
  AND ride_id != p_ride_id;

  -- 4. Close piso_entries and rto_entries (THE FIX)
  UPDATE public.piso_entries 
  SET status = 'closed', closed_at = v_closed_at 
  WHERE UPPER(TRIM(tbr_code)) = v_trimmed_code 
  AND status = 'open' 
  AND unit_id = p_unit_id;

  UPDATE public.rto_entries 
  SET status = 'closed', closed_at = v_closed_at 
  WHERE UPPER(TRIM(tbr_code)) = v_trimmed_code 
  AND status = 'open' 
  AND unit_id = p_unit_id;

  -- 5. Check for local duplicate (same ride)
  SELECT EXISTS (
    SELECT 1 FROM public.ride_tbrs 
    WHERE ride_id = p_ride_id 
    AND UPPER(TRIM(code)) = v_trimmed_code
  ) INTO v_is_duplicate;
  
  IF v_is_duplicate THEN
     RETURN jsonb_build_object('success', true, 'is_duplicate', true, 'trip_number', v_trip_number);
  END IF;

  -- 6. Insert into ride_tbrs
  INSERT INTO public.ride_tbrs (ride_id, code, unit_id, trip_number, scanned_at)
  VALUES (p_ride_id, p_code, p_unit_id, v_trip_number, v_closed_at)
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('success', true, 'is_duplicate', false, 'id', v_new_id, 'trip_number', v_trip_number);
END;
$$;

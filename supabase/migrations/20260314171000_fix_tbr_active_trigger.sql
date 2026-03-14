-- Migration: Fix TBR scan concurrency and re-loading logic
-- Allows re-loading TBRs from finished/cancelled rides while blocking active ones.

-- 1. Update the trigger function
CREATE OR REPLACE FUNCTION public.prevent_duplicate_tbr_across_rides()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Advisory lock to prevent race conditions on simultaneous scans of same TBR
  PERFORM pg_advisory_xact_lock(hashtext(UPPER(NEW.code)));

  IF EXISTS (
    SELECT 1
    FROM public.ride_tbrs rt
    JOIN public.driver_rides dr ON dr.id = rt.ride_id
    WHERE UPPER(rt.code) = UPPER(NEW.code)
      AND rt.ride_id != NEW.ride_id
      AND dr.loading_status IN ('pending', 'loading')
  ) THEN
    RAISE EXCEPTION 'Este TBR já está vinculado a outro carregamento ativo';
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Update process_tbr_scan RPC to be consistent with the trigger and localize messages
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
    RETURN jsonb_build_object('success', false, 'error', 'Este TBR já foi finalizado no PS');
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
    RETURN jsonb_build_object('success', false, 'error', 'Este TBR já está vinculado a outro carregamento ativo');
  END IF;

  -- 3. Calculate trip_number based on previous transactions (reincidence)
  SELECT COUNT(DISTINCT ride_id) + 1 INTO v_trip_number
  FROM public.ride_tbrs
  WHERE UPPER(TRIM(code)) = v_trimmed_code
    AND ride_id != p_ride_id;

  -- 4. Close piso_entries and rto_entries
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

-- Migration to optimize Lovable Cloud consumption
-- Consolidates TBR scan logic and improves Realtime filtering

-- 1. Add unit_id to ride_tbrs if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ride_tbrs' AND column_name='unit_id') THEN
        ALTER TABLE public.ride_tbrs ADD COLUMN unit_id UUID REFERENCES public.units(id);
    END IF;
END $$;

-- 2. Backfill unit_id for existing ride_tbrs from their parent ride
UPDATE public.ride_tbrs rt
SET unit_id = dr.unit_id
FROM public.driver_rides dr
WHERE rt.ride_id = dr.id
AND rt.unit_id IS NULL;

-- 3. Create RPC for atomic TBR processing
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
BEGIN
  -- Check if TBR is finished in PS
  IF EXISTS (
    SELECT 1 FROM ps_entries 
    WHERE UPPER(tbr_code) = UPPER(p_code) 
    AND status = 'closed'
    AND unit_id = p_unit_id 
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'TBR finalizado no PS');
  END IF;

  -- Check if TBR exists in another active ride
  IF EXISTS (
    SELECT 1 FROM ride_tbrs rt
    JOIN driver_rides dr ON dr.id = rt.ride_id
    WHERE UPPER(rt.code) = UPPER(p_code)
    AND rt.ride_id != p_ride_id
    AND dr.unit_id = p_unit_id
    AND dr.loading_status IN ('pending', 'loading')
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'TBR já vinculado a outro carregamento ativo');
  END IF;

  -- Calculate trip_number based on previous piso_entries (reincidence)
  SELECT COUNT(DISTINCT ride_id) + 1 INTO v_trip_number
  FROM piso_entries
  WHERE UPPER(tbr_code) = UPPER(p_code)
  AND unit_id = p_unit_id
  AND ride_id != p_ride_id;

  -- Close piso_entries and rto_entries
  UPDATE piso_entries SET status = 'closed', closed_at = v_closed_at WHERE UPPER(tbr_code) = UPPER(p_code) AND status = 'open' AND unit_id = p_unit_id;
  UPDATE rto_entries SET status = 'closed', closed_at = v_closed_at WHERE UPPER(tbr_code) = UPPER(p_code) AND status = 'open' AND unit_id = p_unit_id;

  -- Check for local duplicate (same ride)
  SELECT EXISTS (SELECT 1 FROM ride_tbrs WHERE ride_id = p_ride_id AND UPPER(code) = UPPER(p_code)) INTO v_is_duplicate;
  
  IF v_is_duplicate THEN
     RETURN jsonb_build_object('success', true, 'is_duplicate', true, 'trip_number', v_trip_number);
  END IF;

  -- Insert into ride_tbrs
  INSERT INTO ride_tbrs (ride_id, code, unit_id, trip_number, scanned_at)
  VALUES (p_ride_id, p_code, p_unit_id, v_trip_number, v_closed_at)
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('success', true, 'is_duplicate', false, 'id', v_new_id, 'trip_number', v_trip_number);
END;
$$;

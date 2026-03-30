-- Função para obter os detalhes de um conflito de TBR (quem está com o pacote)
-- Funciona com SECURITY DEFINER para ignorar RLS e encontrar o contexto corretamente
CREATE OR REPLACE FUNCTION public.get_tbr_conflict_context(
  p_code TEXT,
  p_unit_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'success', true,
    'ride_id', dr.id,
    'scanned_at', rt.scanned_at,
    'driver_name', d.name,
    'conferente_name', up.name,
    'started_at', dr.started_at
  ) INTO v_result
  FROM public.ride_tbrs rt
  JOIN public.driver_rides dr ON dr.id = rt.ride_id
  LEFT JOIN public.drivers d ON d.id = dr.driver_id
  LEFT JOIN public.user_profiles up ON up.id = dr.conferente_id
  WHERE UPPER(TRIM(rt.code)) = UPPER(TRIM(p_code))
    AND dr.unit_id = p_unit_id
    AND dr.loading_status IN ('pending', 'loading')
  ORDER BY rt.scanned_at DESC
  LIMIT 1;

  IF v_result IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conflito não localizado no banco.');
  END IF;

  RETURN v_result;
END;
$$;

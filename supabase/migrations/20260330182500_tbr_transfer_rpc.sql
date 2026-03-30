-- Função para transferir um TBR de um carregamento ativo para outro
CREATE OR REPLACE FUNCTION public.transfer_tbr_to_ride(
  p_code TEXT,
  p_new_ride_id UUID,
  p_unit_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_ride_id UUID;
  v_tbr_id UUID;
  v_trimmed_code TEXT := UPPER(TRIM(p_code));
BEGIN
  -- 1. Encontrar o TBR atual confiltante em outra viagem ativa
  SELECT rt.ride_id, rt.id INTO v_old_ride_id, v_tbr_id
  FROM public.ride_tbrs rt
  JOIN public.driver_rides dr ON dr.id = rt.ride_id
  WHERE UPPER(TRIM(rt.code)) = v_trimmed_code
    AND dr.unit_id = p_unit_id
    AND dr.loading_status IN ('pending', 'loading')
    AND rt.ride_id != p_new_ride_id
  ORDER BY rt.scanned_at DESC
  LIMIT 1;

  IF v_old_ride_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'TBR original não localizado em nenhum carregamento ativo.');
  END IF;

  -- 2. Efetuar a transferência do TBR para a nova viagem
  -- Atualizamos também o `scanned_at` para refletir o momento da confirmação de transferência
  UPDATE public.ride_tbrs
  SET ride_id = p_new_ride_id, scanned_at = NOW() 
  WHERE id = v_tbr_id;

  RETURN jsonb_build_object(
    'success', true, 
    'old_ride_id', v_old_ride_id, 
    'new_ride_id', p_new_ride_id
  );
END;
$$;

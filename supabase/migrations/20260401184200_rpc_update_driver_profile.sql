-- Create a secure RPC function to update driver profile data bypassing RLS
CREATE OR REPLACE FUNCTION public.update_driver_profile(
  p_driver_id UUID,
  p_name TEXT,
  p_email TEXT,
  p_whatsapp TEXT,
  p_birth_date DATE,
  p_emergency_contact_1 TEXT,
  p_emergency_contact_2 TEXT,
  p_bio TEXT,
  p_car_plate TEXT,
  p_car_model TEXT,
  p_car_color TEXT,
  p_address TEXT,
  p_neighborhood TEXT,
  p_city TEXT,
  p_state TEXT,
  p_cep TEXT
) RETURNS VOID AS $$
BEGIN
  UPDATE public.drivers
  SET
    name = COALESCE(p_name, name),
    email = p_email,
    whatsapp = p_whatsapp,
    birth_date = p_birth_date,
    emergency_contact_1 = p_emergency_contact_1,
    emergency_contact_2 = p_emergency_contact_2,
    bio = p_bio,
    car_plate = p_car_plate,
    car_model = p_car_model,
    car_color = p_car_color,
    address = p_address,
    neighborhood = p_neighborhood,
    city = p_city,
    state = p_state,
    cep = p_cep
  WHERE id = p_driver_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permission to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.update_driver_profile TO anon;
GRANT EXECUTE ON FUNCTION public.update_driver_profile TO authenticated;

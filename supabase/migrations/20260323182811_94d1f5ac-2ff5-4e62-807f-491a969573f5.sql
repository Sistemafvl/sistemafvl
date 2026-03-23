
-- One-time data fix: insert rescued TBRs into Renan's ride that were blocked by RLS
DO $$
BEGIN
  INSERT INTO ride_tbrs (ride_id, code, trip_number, is_rescue)
  VALUES
  ('7297c266-35c8-4205-a3ad-bf5a86f8f81e', 'TBR329682112', 1, true),
  ('7297c266-35c8-4205-a3ad-bf5a86f8f81e', 'TBR327381139', 1, true),
  ('7297c266-35c8-4205-a3ad-bf5a86f8f81e', 'TBR327385776', 1, true),
  ('7297c266-35c8-4205-a3ad-bf5a86f8f81e', 'TBR327583209', 1, true),
  ('7297c266-35c8-4205-a3ad-bf5a86f8f81e', 'TBR328778471', 1, true),
  ('7297c266-35c8-4205-a3ad-bf5a86f8f81e', 'TBR328838839', 1, true),
  ('7297c266-35c8-4205-a3ad-bf5a86f8f81e', 'TBR329119478', 1, true),
  ('7297c266-35c8-4205-a3ad-bf5a86f8f81e', 'TBR329172211', 1, true),
  ('7297c266-35c8-4205-a3ad-bf5a86f8f81e', 'TBR329241343', 1, true),
  ('7297c266-35c8-4205-a3ad-bf5a86f8f81e', 'TBR329328275', 1, true),
  ('7297c266-35c8-4205-a3ad-bf5a86f8f81e', 'TBR329357292', 1, true),
  ('7297c266-35c8-4205-a3ad-bf5a86f8f81e', 'TBR329366894', 1, true),
  ('7297c266-35c8-4205-a3ad-bf5a86f8f81e', 'TBR329401352', 1, true),
  ('7297c266-35c8-4205-a3ad-bf5a86f8f81e', 'TBR329411751', 1, true),
  ('7297c266-35c8-4205-a3ad-bf5a86f8f81e', 'TBR329501534', 1, true),
  ('7297c266-35c8-4205-a3ad-bf5a86f8f81e', 'TBR329519988', 1, true),
  ('7297c266-35c8-4205-a3ad-bf5a86f8f81e', 'TBR329587939', 1, true),
  ('7297c266-35c8-4205-a3ad-bf5a86f8f81e', 'TBR329591591', 1, true),
  ('7297c266-35c8-4205-a3ad-bf5a86f8f81e', 'TBR329655586', 1, true),
  ('7297c266-35c8-4205-a3ad-bf5a86f8f81e', 'TBR329085159', 1, true)
  ON CONFLICT DO NOTHING;
END $$;

-- Add lacre and vrid to reversa_batches
ALTER TABLE public.reversa_batches 
ADD COLUMN IF NOT EXISTS lacre text,
ADD COLUMN IF NOT EXISTS vrid text;

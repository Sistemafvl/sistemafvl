
-- Add feedback columns to ride_disputes
ALTER TABLE public.ride_disputes 
ADD COLUMN IF NOT EXISTS feedback TEXT CHECK (feedback IN ('positive', 'negative')),
ADD COLUMN IF NOT EXISTS feedback_at TIMESTAMPTZ;

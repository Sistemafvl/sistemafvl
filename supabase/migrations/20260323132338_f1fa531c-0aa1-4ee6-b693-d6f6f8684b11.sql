ALTER TABLE public.queue_entries ADD COLUMN parking_spot TEXT;
ALTER TABLE public.queue_entries REPLICA IDENTITY FULL;
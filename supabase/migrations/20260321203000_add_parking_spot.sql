-- Add parking_spot column to queue_entries
ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS parking_spot TEXT;

-- Index for performance in calling panel
CREATE INDEX IF NOT EXISTS idx_queue_entries_unit_id_called_at ON queue_entries (unit_id, called_at) WHERE (called_at IS NOT NULL);

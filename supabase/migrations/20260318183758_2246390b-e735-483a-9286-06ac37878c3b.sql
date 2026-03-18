CREATE INDEX IF NOT EXISTS idx_piso_entries_unit_status ON piso_entries(unit_id, status);
CREATE INDEX IF NOT EXISTS idx_conferente_sessions_unit ON conferente_sessions(unit_id);
CREATE INDEX IF NOT EXISTS idx_rto_entries_unit_status ON rto_entries(unit_id, status);
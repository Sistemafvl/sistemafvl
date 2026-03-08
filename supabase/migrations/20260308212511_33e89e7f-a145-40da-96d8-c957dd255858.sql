
-- Performance indexes for ride_tbrs
CREATE INDEX IF NOT EXISTS idx_ride_tbrs_code_upper ON ride_tbrs (upper(code));

-- Performance indexes for driver_rides
CREATE INDEX IF NOT EXISTS idx_driver_rides_unit_completed ON driver_rides (unit_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_driver_rides_loading_status ON driver_rides (loading_status);

-- Performance indexes for piso_entries
CREATE INDEX IF NOT EXISTS idx_piso_entries_unit_status ON piso_entries (unit_id, status);
CREATE INDEX IF NOT EXISTS idx_piso_entries_tbr_code_upper ON piso_entries (upper(tbr_code));

-- Performance indexes for ps_entries
CREATE INDEX IF NOT EXISTS idx_ps_entries_unit_status ON ps_entries (unit_id, status);
CREATE INDEX IF NOT EXISTS idx_ps_entries_tbr_code_upper ON ps_entries (upper(tbr_code));

-- Performance indexes for rto_entries
CREATE INDEX IF NOT EXISTS idx_rto_entries_unit_status ON rto_entries (unit_id, status);

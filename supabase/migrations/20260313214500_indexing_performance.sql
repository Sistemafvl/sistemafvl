-- Migration for high-performance indexing to eliminate sequential scans
-- Targets: ride_tbrs (4.35B rows read), drivers (491k seq scans), and Realtime churn

-- 1. Optimized indexes for ride_tbrs
CREATE INDEX IF NOT EXISTS idx_ride_tbrs_ride_id ON public.ride_tbrs(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_tbrs_unit_id ON public.ride_tbrs(unit_id);
CREATE INDEX IF NOT EXISTS idx_ride_tbrs_code_upper ON public.ride_tbrs(UPPER(code));

-- 2. Optimized indexes for drivers_public and private drivers table
CREATE INDEX IF NOT EXISTS idx_drivers_cpf ON public.drivers(cpf);
CREATE INDEX IF NOT EXISTS idx_drivers_email ON public.drivers(email);
CREATE INDEX IF NOT EXISTS idx_drivers_active ON public.drivers(active);

-- 3. Optimized indexes for driver_rides
-- Critical for sidebar counts and main operation pages
CREATE INDEX IF NOT EXISTS idx_driver_rides_unit_status ON public.driver_rides(unit_id, loading_status);
CREATE INDEX IF NOT EXISTS idx_driver_rides_completed_at ON public.driver_rides(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_rides_driver_id ON public.driver_rides(driver_id);

-- 4. Optimized indexes for occurrences (Piso, PS, RTO, DNR)
-- These are often searched by TBR code or filtered by unit/ride
CREATE INDEX IF NOT EXISTS idx_piso_entries_tbr_upper ON public.piso_entries(UPPER(tbr_code));
CREATE INDEX IF NOT EXISTS idx_piso_entries_unit_status ON public.piso_entries(unit_id, status);
CREATE INDEX IF NOT EXISTS idx_piso_entries_ride_id ON public.piso_entries(ride_id);

CREATE INDEX IF NOT EXISTS idx_ps_entries_tbr_upper ON public.ps_entries(UPPER(tbr_code));
CREATE INDEX IF NOT EXISTS idx_ps_entries_unit_status ON public.ps_entries(unit_id, status);
CREATE INDEX IF NOT EXISTS idx_ps_entries_ride_id ON public.ps_entries(ride_id);

CREATE INDEX IF NOT EXISTS idx_rto_entries_tbr_upper ON public.rto_entries(UPPER(tbr_code));
CREATE INDEX IF NOT EXISTS idx_rto_entries_unit_status ON public.rto_entries(unit_id, status);
CREATE INDEX IF NOT EXISTS idx_rto_entries_ride_id ON public.rto_entries(ride_id);

CREATE INDEX IF NOT EXISTS idx_dnr_entries_tbr_upper ON public.dnr_entries(UPPER(tbr_code));
CREATE INDEX IF NOT EXISTS idx_dnr_entries_unit_status ON public.dnr_entries(unit_id, status);
CREATE INDEX IF NOT EXISTS idx_dnr_entries_ride_id ON public.dnr_entries(ride_id);

-- 4. Audit/Session tables
CREATE INDEX IF NOT EXISTS idx_conferente_sessions_user_active ON public.conferente_sessions(user_id, active);

-- 5. Unit Logins (frequently scanned during conference programming)
CREATE INDEX IF NOT EXISTS idx_unit_logins_unit_active ON public.unit_logins(unit_id, active);

-- 6. Helper for checking reincidence in process_tbr_scan
CREATE INDEX IF NOT EXISTS idx_piso_entries_reincidence ON public.piso_entries(UPPER(tbr_code), unit_id);

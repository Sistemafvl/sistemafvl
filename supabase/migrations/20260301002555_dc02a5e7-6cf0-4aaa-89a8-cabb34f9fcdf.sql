
-- Step 1: Delete duplicate ride_tbrs, keeping the earliest scanned_at for each (ride_id, trip_number, UPPER(code))
DELETE FROM ride_tbrs a
USING ride_tbrs b
WHERE a.ride_id = b.ride_id
  AND UPPER(a.code) = UPPER(b.code)
  AND a.trip_number = b.trip_number
  AND a.id <> b.id
  AND (a.scanned_at > b.scanned_at OR (a.scanned_at = b.scanned_at AND a.id > b.id));

-- Step 2: Create unique index to prevent future duplicates
CREATE UNIQUE INDEX ride_tbrs_unique_code_per_ride ON ride_tbrs (ride_id, trip_number, (UPPER(code)));

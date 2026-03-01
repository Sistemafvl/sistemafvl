

## Problem
When a TBR code is scanned in Retorno Piso, the system does not check if that TBR already exists as an open entry. This allows duplicate registrations of the same TBR code.

## Solution
Add a duplicate check in `handleTbrKeyDown` (around line 167) in `RetornoPisoPage.tsx`. Before opening the modal, query `piso_entries` for an existing open entry with the same `tbr_code` (case-insensitive) and same `unit_id`. If found, show a toast error and abort.

### Implementation Steps

1. **Add duplicate check in `handleTbrKeyDown`** (`src/pages/dashboard/RetornoPisoPage.tsx`)
   - After TBR validation passes (line 176), before the ride_tbrs lookup, query:
     ```sql
     piso_entries WHERE tbr_code ilike code AND unit_id = unitSession.id AND status = 'open'
     ```
   - If a matching entry exists, show a destructive toast: "TBR já registrado no Retorno Piso" and return early without opening the modal.

2. **Also check other occurrence tables** (ps_entries, rto_entries, dnr_entries) for open entries with the same TBR code, showing the appropriate message for each (e.g., "TBR já registrado no PS").

This ensures the TBR uniqueness constraint is respected across the system -- a TBR can only exist in one active location at a time.


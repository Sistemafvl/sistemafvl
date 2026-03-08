

# Plan: Optimize Cloud Consumption

## Problem
The system consumes ~$3.11/day in backend operations and will exceed the $25 monthly limit within hours. The main culprits are:

1. **QueuePanel** polls every 5 seconds + Realtime (double fetch)
2. **DashboardHome** fires 4 independent useEffects on mount (feedback, DNR, metrics, insights, charts) — many with full-table scans
3. **DashboardMetrics** fetches driver_rides twice (once for metrics, once for charts), and fetches ALL ride_tbrs with pagination for chart data
4. **DashboardInsights** fires 4 separate useEffects, each doing heavy queries with fetchAllRows on piso/ps/rto tables
5. **InsucessoBalloon** polls every 60s + Realtime (double mechanism)
6. **ConferenciaCarregamentoPage** fetches ALL TBRs for all rides on every Realtime event
7. **SystemUpdates** Realtime triggers full refetch on any change
8. **staleTime** is only 30s globally — very aggressive for data that doesn't change often

## Optimization Strategy

### 1. Increase Global staleTime and Add Per-Query Configuration
- Change global `staleTime` from 30s to **5 minutes** (300,000ms)
- For critical real-time pages (Conferência), keep lower staleTime via per-query override

### 2. Remove QueuePanel Polling (Keep Only Realtime)
- Remove the 5-second `setInterval` polling — Realtime already handles it
- This alone saves ~17,000 queries/day (2 queries × 12/min × 60min × 24h)

### 3. Remove InsucessoBalloon Polling (Keep Only Realtime)
- Remove the 60s `setInterval` — Realtime already covers inserts
- Add Realtime listener for `piso_entries` changes too

### 4. Consolidate DashboardHome Queries
- Merge the feedback + DNR fetches into a single `useEffect` with `Promise.all`
- Use `count + head` for feedback instead of fetching all rows (only need average — use RPC or aggregate)
- Use `count + head` grouped by status for DNR instead of fetching all rows

### 5. Optimize DashboardMetrics — Eliminate Duplicate Queries
- The `fetchAll` and `fetchChartData` both query `driver_rides` for the same date range — consolidate into one shared fetch
- For TBR line chart, use the RPC `get_unit_tbr_count` per day instead of fetching all ride_tbrs rows

### 6. Optimize DashboardInsights — Reduce Heavy Queries
- `fetchInsights`, `fetchTopDrivers`, `fetchTopReturns`, `fetchTopConferentes` all run independently — merge into a single `useEffect` with `Promise.all`
- The return rate calculation fetches ALL piso/rto/ps entries then counts them — use `count + head` instead
- `ride_tbrs` count query (line 85, 109) uses `.in("ride_id", rideIds)` which can be massive — use the existing RPC instead

### 7. Debounce Realtime Handlers in ConferenciaCarregamentoPage
- Currently every Realtime event triggers a full `fetchRides()` — add a 2-second debounce to batch multiple rapid events

### 8. Cache Conferentes and Unit Logins
- `user_profiles` (conferentes list) is fetched on every page that needs it — cache with React Query using a long staleTime (10 min)
- `unit_logins` similarly fetched multiple times — cache

### 9. Use `count: 'exact', head: true` Where Possible
- DashboardHome DNR: Instead of fetching all rows just to count/sum, use separate count queries per status
- DashboardHome feedback: Use a DB aggregate or RPC instead of fetching all reviews

## Technical Details

### Files to Modify
1. **`src/App.tsx`** — Change `staleTime: 30_000` → `staleTime: 300_000`
2. **`src/components/dashboard/QueuePanel.tsx`** — Remove 5s polling interval (lines 196-202)
3. **`src/components/dashboard/InsucessoBalloon.tsx`** — Remove 60s polling, add `piso_entries` Realtime channel
4. **`src/pages/dashboard/DashboardHome.tsx`** — Consolidate useEffects, use count queries for DNR
5. **`src/components/dashboard/DashboardMetrics.tsx`** — Consolidate ride queries, remove duplicate fetches
6. **`src/components/dashboard/DashboardInsights.tsx`** — Merge 4 useEffects into 1, use count queries
7. **`src/pages/dashboard/ConferenciaCarregamentoPage.tsx`** — Add debounce to Realtime handler

### Estimated Impact
- QueuePanel polling removal: **-17,000 queries/day**
- InsucessoBalloon polling removal: **-2,880 queries/day**
- DashboardMetrics consolidation: **-50% queries per dashboard load**
- DashboardInsights consolidation: **-40% queries per dashboard load**
- staleTime increase: **-70% refetch on navigation** (pages revisited within 5 min won't refetch)

### No Database Migration Needed
All changes are frontend-only query optimizations.


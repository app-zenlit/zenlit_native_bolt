## Goal
- Create a server-side function that sets location coordinates to NULL if not updated within a threshold (default 3 minutes, overrideable to 5).
- Base decision on `public.locations.updated_at` timestamp.

## Changes (DDL)
### 1) Create function `expire_stale_locations(minutes int default 3)`
- Language: plpgsql, `SECURITY DEFINER`, `SET search_path = public`.
- Logic: `UPDATE public.locations SET lat_full = NULL, long_full = NULL, lat_short = NULL, long_short = NULL WHERE updated_at < (now() - (make_interval(mins => minutes))) AND (lat_full IS NOT NULL OR long_full IS NOT NULL OR lat_short IS NOT NULL OR long_short IS NOT NULL);` Return the number of rows updated.
- RLS-safety: SECURITY DEFINER runs as owner to bypass RLS; keep function body minimal and scoped to `public.locations`.

### 2) Optional: Convenience view `locations_current`
- Project coordinates as NULL when stale without mutating table:
  - `CASE WHEN updated_at < now() - interval '3 minutes' THEN NULL ELSE lat_full END AS lat_full`
  - Same for other coordinate fields.
- Benefits: Always reflects freshness; avoids constant writes.

### 3) Optional scheduling (pg_cron)
- If `pg_cron` is installed, create a job: run `select public.expire_stale_locations(3);` every minute.
- Provide job id management and comments for disabling/updating.

## Validation
- Insert/update test rows and call `select public.expire_stale_locations(3);` to confirm rows older than threshold are nulled.
- Verify RLS unaffected for regular queries.
- Confirm indexes/policies remain valid since only columns are set to NULL.

## Delivery
- Apply one migration that:
  - Creates the function.
  - Optionally creates the view.
  - Optionally registers a pg_cron job when available.
- Provide usage examples: `select public.expire_stale_locations(5);`, `select * from public.locations_current;`.

## Safety
- Idempotent `CREATE OR REPLACE FUNCTION`.
- No destructive schema changes; only data updates on stale rows.
- Easy rollback: drop function/view and remove cron schedule.
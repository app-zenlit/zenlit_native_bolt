## Problem Summary
- Excessive repeated logs from realtime and screen events clutter the terminal (e.g., channel status changes, subscriptions, focus/blur, presence sync). Examples:
  - app/messages/[id].tsx:387, 392, 416, 424, 433, 454, 534, 546, 664, 672, 743–759
  - app/messages/index.tsx: logs under RT:List for subscriptions and status
  - app/radar.tsx: RT:Radar subscription/status logs
  - src/utils/realtime.ts: logger emits `[${tag}] ...` for many status updates

## Approach
- Introduce a small logger with levels (error, warn, info, debug) controlled by `EXPO_PUBLIC_LOG_LEVEL`.
- Replace/route existing `console.log` calls to the logger and demote non-critical messages to `debug` or remove them.
- Add duplicate suppression to avoid spamming the same message within a short window.

## Changes
### 1) Add `src/utils/logger.ts`
- Expose functions: `error`, `warn`, `info`, `debug(tag, msg, ...args)`.
- Read `process.env.EXPO_PUBLIC_LOG_LEVEL` (default: `warn`).
- Implement 1-second dedupe: skip identical tag+msg when repeated >3 times per second.
- In production (`__DEV__ === false`), force level to `error` unless explicitly set.

### 2) Update `src/utils/realtime.ts`
- Replace internal `console.log` with `logger`:
  - Channel status changes: `info`
  - Presence sync and broadcast messages: `debug`
  - Subscribing/unsubscribing: `info`
  - Errors: `error`
- Keep `logTag` support so messages remain grouped by `[RT:Thread]`, `[RT:List]`.

### 3) Update noisy screens/components
- app/messages/[id].tsx: route logs through `logger` and demote/remove:
  - Remove `Screen focused/blurred` logs.
  - Demote `Processing batched events`, `Loading older messages`, `User scrolled to bottom...` to `debug`.
  - Keep `console.error` as `logger.error` for failures.
- app/messages/index.tsx: demote subscription/status logs to `debug`, keep errors.
- app/radar.tsx: demote subscription/status logs to `debug`, keep errors.
- src/utils/chatRealtimeSetup.ts: channel status changed → `info` via logger.
- src/lib/supabase.ts: retain errors; demote noisy `Token refreshed successfully` to `info` (or remove).

### 4) Environment & defaults
- .env: add `EXPO_PUBLIC_LOG_LEVEL=warn` (you can set `error` for minimal output, or `info` for major events, `debug` for full tracing).
- Optional: `EXPO_PUBLIC_LOG_DUPLICATE_WINDOW_MS=1000` and `EXPO_PUBLIC_LOG_DUPLICATE_MAX=3` for tuning suppression.

## Verification
- Run the app with `EXPO_PUBLIC_LOG_LEVEL=warn`: terminal shows errors and warnings only, hiding info/debug noise.
- Switch to `info` temporarily to confirm major events still visible.
- Confirm no functional changes (messaging, radar, presence) and no missing error reporting.

## What I Will Implement
- Create the `logger.ts` utility.
- Wire `src/utils/realtime.ts` to use the logger.
- Update the three main screens (`messages/[id].tsx`, `messages/index.tsx`, `radar.tsx`) and two utilities (`chatRealtimeSetup.ts`, `lib/supabase.ts`) to use logger and demote/remove verbose logs.
- Add env config to `.env`.
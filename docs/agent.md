# Zenlit Native – Architecture and Code Flow

## Purpose
Single-source reference for how the app is structured and how data flows through the system. Aligns to the product vision in `zenlit_app_vision.md`.

## High-Level Architecture
- Entry: Expo Router boot via `index.ts:1`
- Root Layout: Providers and global shell in `app/_layout.tsx:66-92`
  - Visibility state: `src/contexts/VisibilityContext.tsx:65-74, 117-169`
  - Messaging state: `src/contexts/MessagingContext.tsx:46-70, 119-180, 192-212`
- Navigation/screens: Expo Router files under `app/`
  - Get Started: `app/index.tsx`
  - Auth: `app/auth/*`
  - Radar: `app/radar.tsx`
  - Feed: `app/feed.tsx` + `src/components/FeedList.tsx`
  - Chat: `app/messages/index.tsx`, `app/messages/[id].tsx`
  - Profile: `app/profile/*`

## Backend Integration
- Supabase client: `src/lib/supabase.ts:188-207`
  - Defensive env handling with stub mode when keys are missing.
  - Auth events: `src/lib/supabase.ts:212-222`
  - Invalid session clearing: `src/lib/supabase.ts:224-235`
- Service layer (typed calls): `src/services/index.ts`
  - Profiles: `src/services/profileService.ts`
  - Posts: `src/services/postService.ts`
  - Locations (proximity/anonymity): `src/services/locationDbService.ts`
  - Messaging (threads, messages, unread): `src/services/messagingService.ts`
  - Storage: `src/services/storageService.ts`

## Realtime and Anonymity
- Realtime manager: `src/utils/realtime.ts`
  - Conversation subscribe: `src/utils/realtime.ts:61-121`
    - Private channel pattern: `chat:{currentUserId}`
    - Broadcast INSERTs and `postgres_changes` UPDATEs filtered per thread.
  - Presence and typing: `src/utils/realtime.ts:142-163, 254-272`
  - Retry/backoff: `src/utils/realtime.ts:274-296`
  - Factory: `src/utils/realtime.ts:338-356`
- Chat setup helper: `src/utils/chatRealtimeSetup.ts:32-71`
- Messaging context (unread and active thread): `src/contexts/MessagingContext.tsx:72-108, 119-180, 214-241`
- Anonymous identity is decided by proximity checks:
  - Proximity read: `src/services/locationDbService.ts:114-217`
  - Anonymous UI rules used in chat thread: `app/messages/[id].tsx` (isAnonymous state and header/composer behavior)

## UI/Data Flow Examples
1) Radar → Chat initiation
   - Radar loads nearby users: `app/radar.tsx:50-84`
   - Location realtime updates drive silent refresh: `app/radar.tsx:176-233`
   - Tapping user opens profile or starts a thread via services.

2) Chat thread lifecycle
   - Initial messages fetched: `app/messages/[id].tsx:191-205, 158-173`
   - Realtime subscription on focus: `src/utils/chatRealtimeSetup.ts:41-64`
   - Event batching and upsert reducer: `app/messages/[id].tsx:80-146`
   - Read/delivered marking via context services: `src/contexts/MessagingContext.tsx:182-212`

3) Feed
   - Fetch nearby posts: `src/components/FeedList.tsx:39-48`
   - Adapt to display component format: `src/components/FeedList.tsx:54-75`

## Logging and Diagnostics
- Levelled logger with duplicate suppression: `src/utils/logger.ts:1-54`
- Suggested prod env var: `EXPO_PUBLIC_LOG_LEVEL=error`

## Configuration and Keys
- Required runtime env (prod):
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Client safeguards preview builds with stub mode: `src/lib/supabase.ts:73-86, 205-207`

## Store Readiness Checklist
- Permissions:
  - Location: flows in `src/services/locationService.ts:29-47, 49-69, 71-114, 116-198`
  - Ensure platform permission texts and privacy policy reflect radar behavior.
- Assets: Verify icons/splash/adaptive in `assets/` and `app.json`.
- Fonts: Inter Medium loaded in layout: `app/_layout.tsx:21`
- Stability:
  - Realtime reconnection: `src/utils/realtime.ts:165-201`
  - Error paths are handled via logger and UI states.

## File Map (selected)
- `index.ts:1` – Expo Router entry
- `app/_layout.tsx:66-92` – Providers and shell
- `src/lib/supabase.ts:188-207` – Client init
- `src/utils/realtime.ts:61-121` – Conversation subscription
- `src/contexts/MessagingContext.tsx:72-108` – Unread refresh
- `src/components/FeedList.tsx:39-48` – Feed data load
- `app/radar.tsx:176-233` – Realtime location subscription
- `app/messages/[id].tsx:80-146` – Message reducer

## Alignment with Vision
- Follows `zenlit_app_vision.md` principles: radar‑first, consent‑first, proximity‑based anonymity, and smooth realtime.

## Maintenance Notes
- Services are the single API surface; keep UI decoupled from schema details.
- Prefer logger over raw console and use `info`/`debug` sparingly.

---
This document is the authoritative, up‑to‑date reference for the app’s architecture. Update it alongside significant structural changes.

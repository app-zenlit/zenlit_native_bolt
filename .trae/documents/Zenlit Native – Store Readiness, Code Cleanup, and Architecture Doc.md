## Goals
- Prepare the app for store submission by removing dead code, consolidating docs, and tightening architecture.
- Read code end‑to‑end and produce a single reference doc `agent.md` that explains the structure and flow, aligned with `zenlit_app_vision.md`.
- Keep only essential documentation; delete or archive operational notes.

## Quick Architecture Snapshot
- Entry: `index.ts` → `expo-router/entry`
- Root layout: `app/_layout.tsx` provides providers (`VisibilityProvider`, `MessagingProvider`), global auth session handling via `src/lib/supabase`.
- Navigation: Expo Router screens under `app/` (`radar`, `feed`, `create`, `messages`, `profile`, `auth`).
- Data/Backend: Supabase client with defensive stub in `src/lib/supabase.ts`; typed services in `src/services/*` for profiles, posts, locations, messages, storage.
- Realtime: `src/utils/realtime.ts` + `src/utils/chatRealtimeSetup.ts`; conversations use private channel `chat:{currentUserId}` and `postgres_changes` for status.
- State: Contexts in `src/contexts` for visibility and messaging (unread counts, active thread); components in `src/components`.
- Logging: `src/utils/logger.ts` levelled logger with duplicate suppression.

## Documentation Consolidation
- Keep: `zenlit_app_vision.md` (product vision), `docs/backend_structure.md`, `docs/migrations_audit.md` (backend truth sources).
- Consolidate: Merge the REALTIME series into `agent.md` sections (Realtime Architecture, QA checklist, Verification). De‑duplicate overlapping content.
- Archive/Delete:
  - `.trae/documents/*` (internal implementation notes) → remove or move to `docs/archive/`.
  - Root: `REALTIME_FIXES_SUMMARY.md`, `REALTIME_FIX_COMPLETE.md`, `REALTIME_IMPLEMENTATION_SUMMARY.md`, `REALTIME_QA_CHECKLIST.md`, `REALTIME_VERIFICATION.md` → integrate into `agent.md` and delete originals.
  - Keep `DATABASE_SECURITY_FIXES.md` only if separate DB change log is desired; otherwise fold into `agent.md` DB section.

## Code Cleanup
- Remove duplicate/unused constants:
  - Delete `src/constants/socialPlatforms.tsx` (old API; conflicts with `src/constants/socialPlatforms.ts`). Current code imports the `.ts` version.
  - Delete `src/constants/authMock.ts` (unused; no references).
- Verify and keep:
  - `src/utils/*` (used across app): `applyWebShadowPatch.ts`, `shadow.ts`, `imageCompression.ts`, `uuid.ts`, `logger.ts`.
  - Services: `messagingService.ts`, `locationDbService.ts`, `locationService.ts`, `postService.ts`, `profileService.ts`, `storageService.ts` (all referenced).
- No runtime changes to business logic; only removal of truly dead/duplicate files.

## File Arrangement
- Docs:
  - Create `docs/agent.md` as the authoritative architecture doc.
  - Optionally create `docs/archive/` for legacy notes if you prefer retaining them; otherwise delete.
- Code:
  - Keep current folder layout (Expo Router prefers `app/`); no moves needed.

## `agent.md` Content Outline
- Overview and principles (aligned to `zenlit_app_vision.md`).
- App structure: entry, providers, navigation, screen responsibilities.
- Data layer: services, types, schema highlights with references.
- Realtime & anonymity: channels, event handling, proximity rules.
- Error handling & logging: global auth recovery, logger levels.
- Store readiness checklist: env/keys, permissions (`expo-location`), fonts, icons/splash, privacy copy.
- Code references with `file_path:line_number` hyperlinks for key functions.

## Store Readiness Checklist (to include in `agent.md`)
- Supabase config: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` set for production; client stub safeguards preview.
- Permissions: location permission strings and flows; verify `expo-location` behavior.
- Assets: icons, splash, adaptive icons configured in `app.json`/`eas.json`.
- Logging: set `EXPO_PUBLIC_LOG_LEVEL=error` for production builds.
- QA flows: Radar, Feed, Create, Chat (list/thread), Profile, onboarding.

## Verification Steps
- After cleanup:
  - Run grep to confirm removed files have zero references.
  - Build and run; validate screens and realtime behaviors.
  - Confirm docs present: `docs/agent.md`, `zenlit_app_vision.md`, `docs/backend_structure.md`, `docs/migrations_audit.md`.

## Next Actions (upon approval)
1. Remove `.trae/documents/*`.
2. Delete `src/constants/socialPlatforms.tsx` and `src/constants/authMock.ts`.
3. Consolidate REALTIME and DB notes into `docs/agent.md`; delete the redundant root realtime docs.
4. Create `docs/agent.md` with the outlined content and code references.
5. Set production logging level and confirm env handling.

Please approve and I will execute the cleanup and produce `docs/agent.md` with code‑referenced sections.
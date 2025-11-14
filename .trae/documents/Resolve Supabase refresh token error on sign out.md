## Problem Summary
- Console shows `[Supabase] User signed out, session cleared` followed by `AuthApiError: Invalid Refresh Token: Refresh Token Not Found`.
- This typically occurs when `signOut` or background auto-refresh attempts to revoke/refresh using a missing/cleared refresh token.
- Current code logs and manually clears storage on `SIGNED_OUT` and calls `signOut` at logout.
  - `src/lib/supabase.ts:212-221` subscribes to `onAuthStateChange` and removes `supabase.auth.token`.
  - `app/profile/index.tsx:141-146` calls `await supabase.auth.signOut()` then navigates.

## Root Causes
- Manual storage clearing during `SIGNED_OUT` can race with internal revoke logic.
- Calling `signOut` when no session exists causes a revoke call without a refresh token.
- Multiple client instances or overlapping auto-refresh timers can create race conditions.

## Planned Fixes
1) Guard logout against missing sessions
- In `app/profile/index.tsx:141-146`:
  - Get the current session first; only call `signOut` if a session exists.
  - Wrap `signOut` in `try/catch` and ignore `AuthApiError` with refresh-token messages.
  - Use `scope: 'global'` to fully revoke when signed in.

2) Remove risky manual token deletion on SIGNED_OUT
- In `src/lib/supabase.ts:212-221`:
  - Stop calling `AsyncStorage.removeItem('supabase.auth.token')`; the SDK already manages storage.
  - Keep the info log, rely on the library to clean tokens.

3) Make `clearInvalidSession` safe
- In `src/lib/supabase.ts:224-235`:
  - Check `getSession()` first; if no session, skip `signOut`.
  - Remove the manual `AsyncStorage.removeItem('supabase.auth.token')` call; just log and return.

4) Ensure single Supabase client
- Confirm only `src/lib/supabase.ts` creates a client and that it is reused across the app.
- This is already the case, but document the rule to avoid future race conditions.

## Code Changes (targeted)
- `app/profile/index.tsx:141-146`
  - Guarded sign out:
    - `const { data: { session } } = await supabase.auth.getSession(); if (session) { try { await supabase.auth.signOut({ scope: 'global' }); } catch (e) { /* ignore known refresh token errors */ } } router.replace('/auth');`
- `src/lib/supabase.ts:212-221`
  - Remove `AsyncStorage.removeItem('supabase.auth.token')`; keep the info log.
- `src/lib/supabase.ts:224-235`
  - Update `clearInvalidSession` to check session first and skip `signOut` if none; remove manual storage deletion.

## Verification
- Trigger logout from Profile; expect no red `AuthApiError` after the info `User signed out` log.
- Confirm auto-refresh remains functional for active sessions.
- Run the app and monitor auth events; ensure navigation to `/auth` happens reliably.

## Notes & References
- Supabase v2 client is configured correctly for RN: `storage: AsyncStorage`, `autoRefreshToken: true`, `persistSession: true` (src/lib/supabase.ts:190-197).
- Related community reports indicate race conditions and missing token states can cause this error; guarding and avoiding manual token manipulation resolves it. See GitHub issues: supabase/ssr#68; supabase/supabase#18981.

## Next
- After approval, implement the small guards and removal lines, then test logout flow end-to-end.
## Root Cause

* `.env` works in local dev because Metro loads it and inlines `EXPO_PUBLIC_*` values.

* In EAS cloud builds, `.env` files on your machine are not present unless you push them to EAS or define project variables; therefore `process.env.SUPABASE_*` is undefined in production.

* Only `EXPO_PUBLIC_*` variables referenced with dot notation are inlined at build time. Dynamic access (e.g., `process.env[key]` or bracket access) is not inlined.

* Your Supabase client falls back to a stub when config is missing, causing the "Not configured" error.

## Correct Approach (SDK 54)

1. Use `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` for public config.
2. Expose them in `app.config.ts` under `extra` so they are available at runtime via `Constants.expoConfig.extra.*` (your file already does this).
3. Provide values to EAS via Project Variables or EAS Secrets; do not rely on local `.env` for cloud builds.
4. Ensure build profiles in `eas.json` select an EAS environment (e.g., `production`) where those variables are defined.
5. Initialize Supabase using `Constants.expoConfig.extra` (or `process.env.EXPO_PUBLIC_*` with dot notation). Your `src/lib/supabase.ts` already checks `Constants.expoConfig.extra`.

## Implementation Steps

* Define env vars on EAS (recommended):

  * In expo.dev → Project → Variables → environment `production`: add `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Plain Text visibility is fine; anon key is public).

  * Or push local `.env` to EAS: `eas secret:push --scope project --env-file .env`.

* Set build profiles to use an EAS environment:

  * In `eas.json`, for the profile used by Play Store builds (e.g., `preview` or `production`), add `"environment": "production"` (or the environment where you created variables).

* Verify app config resolution:

  * Trigger an EAS build.

  * In build logs, inspect “Read app config” and ensure `expoConfig.extra.supabaseUrl/supabaseAnonKey` have values.

* Verify runtime:

  * After installing the build from Play Store internal testing, confirm backend works (auth, queries) and logs do not show the Supabase stub warning.

## Codebase Alignment

* Supabase init reads config in this order:

  * `process.env.EXPO_PUBLIC_*` → `src/lib/supabase.ts:15–17`

  * `Constants.expoConfig.extra.*` → `src/lib/supabase.ts:20–23`

  * Falls back to Manifest extra → `src/lib/supabase.ts:26–29`

* When values are present, `hasValidConfig` becomes true and the real client is created → `src/lib/supabase.ts:210–221`.

* The stub currently throws the error you saw when `MessagingContext` calls `auth.getUser()` → `src/contexts/MessagingContext.tsx:56–60`.

## Optional Hardening

* Standardize all env access to either `Constants.expoConfig.extra.*` or dot‑notation `process.env.EXPO_PUBLIC_*` to avoid dynamic lookup pitfalls.

* Add a small guard where sensitive flows run only when `supabaseReady` is true.

* Suppress noisy TypeScript diagnostics from library configs with `skipLibCheck` in `tsconfig.json`.

## References

* Expo env vars: <https://docs.expo.dev/guides/environment-variables/>

* EAS env management: <https://docs.expo.dev/eas/environment-variables/>

* App config and runtime `Constants.expoConfig`: <https://docs.expo.dev/workflow/configuration/>


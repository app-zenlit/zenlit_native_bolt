// Dynamic Expo config to allow environment-driven values
// This file lets us derive iOS URL schemes from .env instead of hardcoding.

import { ConfigContext, ExpoConfig } from "expo/config";

const uniqueSchemes = (schemes: Array<string | undefined>): string[] =>
  Array.from(new Set((schemes.filter(Boolean) as string[])));

export default ({ config }: ConfigContext): ExpoConfig => {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  // Google OAuth configuration removed

  // Ensure redirectScheme is a string, even if config.scheme is an array
  const configSchemeString = Array.isArray(config.scheme)
    ? config.scheme[0]
    : config.scheme;
  const redirectScheme: string = configSchemeString || "zenlit";

  const existingInfoPlistSchemes: string[] =
    Array.isArray(config?.ios?.infoPlist?.CFBundleURLTypes) &&
    config.ios?.infoPlist?.CFBundleURLTypes?.[0]?.CFBundleURLSchemes
      ? (config.ios!.infoPlist!.CFBundleURLTypes![0]!.CFBundleURLSchemes as string[])
      : [];

  const configSchemesArray: string[] = Array.isArray(config.scheme)
    ? (config.scheme as string[])
    : (config.scheme ? [config.scheme as string] : []);

  const mergedSchemes = uniqueSchemes([
    redirectScheme,
    ...configSchemesArray,
    ...existingInfoPlistSchemes,
  ]);

  const result: ExpoConfig = {
    ...config,
    // Ensure required top-level fields are present for typing
    name: config.name ?? "zenlit",
    slug: config.slug ?? "zenlit",
    owner: "arjungowdal4601",
    scheme: redirectScheme,
    ios: {
      ...(config.ios ?? {}),
      bundleIdentifier: "com.arjungowdal4601.zenlit",
      infoPlist: {
        ...(config.ios?.infoPlist ?? {}),
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: mergedSchemes,
          },
        ],
      },
    },
    android: {
      ...(config.android ?? {}),
      package: "com.arjungowdal4601.zenlit",
    },
    runtimeVersion: {
      policy: "sdkVersion",
    },
    extra: {
      ...(config.extra ?? {}),
      supabaseUrl,
      supabaseAnonKey,
      eas: config.extra?.eas,
      router: config.extra?.router,
    },
  };

  return result;
};
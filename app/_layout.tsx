import '../src/polyfills';
import '../src/utils/applyWebShadowPatch';

import React, { useEffect, useState } from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Inter_500Medium } from '@expo-google-fonts/inter';

import { VisibilityProvider } from '../src/contexts/VisibilityContext';
import { MessagingProvider } from '../src/contexts/MessagingContext';
import { ProfileProvider } from '@/src/contexts/ProfileContext';
import { theme } from '../src/styles/theme';
import { supabase, supabaseReady } from '../src/lib/supabase';
import Navigation from '../src/components/Navigation';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { logger } from '../src/utils/logger';
import { determinePostAuthRoute } from '../src/utils/authNavigation';

const RootLayout: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const normalizedPath = pathname ?? '/';
  const isAuthRoute = normalizedPath.startsWith('/auth');
  const isOnboardingRoute = normalizedPath.startsWith('/onboarding');
  const isGetStartedRoute = normalizedPath === '/' || normalizedPath.length === 0;
  const isPreauthRoute = isAuthRoute || isOnboardingRoute;
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [fontsLoaded] = useFonts({ Inter_500Medium });

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      window.requestAnimationFrame(() => {
        const activeElement = document.activeElement as HTMLElement | null;
        activeElement?.blur();
      });
    }
  }, [pathname]);

  useEffect(() => {
    logger.info('App', 'RootLayout mounted', { supabaseReady });

    const handleAuthError = async () => {
      try {
        if (!supabaseReady) {
          logger.warn('App', 'Supabase not ready, skipping session check');
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        setIsAuthenticated(!!session);
        logger.info('Auth', 'Initial session check complete', { hasSession: !!session });
      } catch (err) {
        logger.error('Auth', 'Error checking session:', err);
      }
    };

    handleAuthError();
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        setIsAuthenticated(!!session);
      }
    );
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (!fontsLoaded) {
    // Avoid rendering before fonts load to ensure consistent typography
    return null;
  }

  useEffect(() => {
    if (!supabaseReady || !isAuthenticated) {
      return;
    }

    if (!isPreauthRoute && !isGetStartedRoute) {
      return;
    }

    let cancelled = false;

    const redirectIfNeeded = async () => {
      try {
        const targetRoute = await determinePostAuthRoute();
        if (!targetRoute || cancelled) {
          return;
        }
        if (targetRoute !== normalizedPath) {
          logger.info('Auth', 'Redirecting authenticated user based on profile state', {
            targetRoute,
            currentPath: normalizedPath,
          });
          router.replace(targetRoute);
        }
      } catch (error) {
        logger.error('Auth', 'Redirect evaluation failed', error);
      }
    };

    redirectIfNeeded();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isGetStartedRoute, isPreauthRoute, normalizedPath, router, supabaseReady]);

  if (!fontsLoaded) {
    // Avoid rendering before fonts load to ensure consistent typography
    return null;
  }

  const shouldShowNav = isAuthenticated && !isPreauthRoute && !isGetStartedRoute;

  return (
    <SafeAreaProvider>
      <VisibilityProvider>
        <MessagingProvider>
          <ProfileProvider>
            <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
              <StatusBar style="light" backgroundColor={theme.colors.background} />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: theme.colors.background },
                }}
              >
                {/** Ensure Get Started (index) is fully immersive: no header */}
                <Stack.Screen name="index" options={{ headerShown: false }} />
              </Stack>
              {shouldShowNav ? <Navigation /> : null}
            </View>
          </ProfileProvider>
        </MessagingProvider>
      </VisibilityProvider>
    </SafeAreaProvider>
  );
};

export default RootLayout;

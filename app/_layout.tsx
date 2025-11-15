import '../src/polyfills';
import '../src/utils/applyWebShadowPatch';

import React, { useEffect, useState } from 'react';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Inter_500Medium } from '@expo-google-fonts/inter';

import { VisibilityProvider } from '../src/contexts/VisibilityContext';
import { MessagingProvider } from '../src/contexts/MessagingContext';
import { theme } from '../src/styles/theme';
import { supabase, clearInvalidSession, supabaseReady } from '../src/lib/supabase';
import Navigation from '../src/components/Navigation';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { logger } from '../src/utils/logger';

const RootLayout: React.FC = () => {
  const pathname = usePathname();
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
        if (error && error.message.includes('refresh_token_not_found')) {
          logger.info('Auth', 'Invalid refresh token detected, clearing session');
          await clearInvalidSession();
        }
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

  return (
    <SafeAreaProvider>
      <VisibilityProvider>
        <MessagingProvider>
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
            {(() => {
              const isPreauthRoute = pathname?.startsWith('/auth') || pathname?.startsWith('/onboarding');
              const isGetStartedRoute = pathname === '/';
              const shouldShowNav = isAuthenticated && !isPreauthRoute && !isGetStartedRoute;
              return shouldShowNav ? <Navigation /> : null;
            })()}
          </View>
        </MessagingProvider>
      </VisibilityProvider>
    </SafeAreaProvider>
  );
};

export default RootLayout;

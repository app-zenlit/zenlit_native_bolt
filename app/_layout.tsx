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
import { theme } from '../src/styles/theme';
import { supabase, supabaseReady } from '../src/lib/supabase';
import Navigation from '../src/components/Navigation';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { logger } from '../src/utils/logger';
import { determinePostAuthRoute } from '../src/utils/authNavigation';

const RootLayout: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
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
    const initializeApp = async () => {
      try {
        if (!supabaseReady) {
          logger.warn('App', 'Supabase not ready, waiting...');
          // In a real app we might want to wait or show an error, 
          // but for now we'll proceed to let the UI handle it or retry.
        }

        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          // User is authenticated, determine where they should go
          const targetRoute = await determinePostAuthRoute({ userId: session.user.id });
          if (targetRoute) {
            logger.info('App', 'Redirecting initial load', { targetRoute });
            router.replace(targetRoute);
          }
        }
      } catch (e) {
        logger.error('App', 'Initialization error', e);
      } finally {
        setIsReady(true);
      }
    };

    if (fontsLoaded) {
      initializeApp();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (event === 'SIGNED_OUT') {
          router.replace('/auth');
        } else if (event === 'SIGNED_IN' && session) {
          // When signing in (e.g. from a deep link or just a state change), 
          // we might want to re-evaluate routing if we are on a public screen
          const current = pathname ?? '/';
          if (current === '/' || current.startsWith('/auth')) {
            const targetRoute = await determinePostAuthRoute({ userId: session.user.id });
            if (targetRoute) router.replace(targetRoute);
          }
        }
      }
    );
    return () => {
      subscription.unsubscribe();
    };
  }, [pathname]);

  if (!fontsLoaded || !isReady) {
    return null; // Or a splash screen component
  }

  // Simple check for showing nav: only show if we are NOT in auth/onboarding/root
  // This is a visual helper, actual protection is done by RLS and logic above
  const isPublicRoute = (pathname === '/' || pathname?.startsWith('/auth') || pathname?.startsWith('/onboarding'));
  const shouldShowNav = !isPublicRoute;

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
                animation: 'fade', // Smooth transitions
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="auth" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            </Stack>
            {shouldShowNav ? <Navigation /> : null}
          </View>
        </MessagingProvider>
      </VisibilityProvider>
    </SafeAreaProvider>
  );
};

export default RootLayout;

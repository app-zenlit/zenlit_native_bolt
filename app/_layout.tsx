import '../src/utils/applyWebShadowPatch';

import React, { useEffect, useState } from 'react';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { VisibilityProvider } from '../src/contexts/VisibilityContext';
import { MessagingProvider } from '../src/contexts/MessagingContext';
import { theme } from '../src/styles/theme';
import { supabase, clearInvalidSession } from '../src/lib/supabase';
import Navigation from '../src/components/Navigation';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

const RootLayout: React.FC = () => {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      window.requestAnimationFrame(() => {
        const activeElement = document.activeElement as HTMLElement | null;
        activeElement?.blur();
      });
    }
  }, [pathname]);

  useEffect(() => {
    // Handle auth errors globally
    const handleAuthError = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error && error.message.includes('refresh_token_not_found')) {
          console.log('Invalid refresh token detected, clearing session');
          await clearInvalidSession();
        }
        setIsAuthenticated(!!session);
      } catch (err) {
        console.error('Error checking session:', err);
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
            />
            {(() => {
              const isPreauthRoute = pathname?.startsWith('/auth') || pathname?.startsWith('/onboarding');
              const shouldShowNav = isAuthenticated && !isPreauthRoute;
              return shouldShowNav ? <Navigation /> : null;
            })()}
          </View>
        </MessagingProvider>
      </VisibilityProvider>
    </SafeAreaProvider>
  );
};

export default RootLayout;

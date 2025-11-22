import '../src/polyfills';
import '../src/utils/applyWebShadowPatch';

import React, { useEffect, useState, useRef } from 'react';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Inter_500Medium } from '@expo-google-fonts/inter';
import * as Notifications from 'expo-notifications';

import { VisibilityProvider } from '../src/contexts/VisibilityContext';
import { MessagingProvider } from '../src/contexts/MessagingContext';
import { ProfileProvider } from '../src/contexts/ProfileContext';
import { theme } from '../src/styles/theme';
import { supabase, supabaseReady } from '../src/lib/supabase';
import Navigation from '../src/components/Navigation';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { logger } from '../src/utils/logger';
import { determinePostAuthRoute, ROUTES } from '../src/utils/authNavigation';
import { useNotifications } from '../src/hooks/useNotifications';
import { checkForAppUpdate, markUpdateDismissed, type AppVersion } from '../src/services/appVersionService';
import { AppUpdateModal } from '../src/components/AppUpdateModal';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const RootLayout: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const segments = useSegments();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [fontsLoaded] = useFonts({ Inter_500Medium });
  const navigationInitialized = useRef(false);
  const lastAuthState = useRef<boolean | null>(null);
  const { notification } = useNotifications();
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [updateVersion, setUpdateVersion] = useState<AppVersion | null>(null);
  const [isCriticalUpdate, setIsCriticalUpdate] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      window.requestAnimationFrame(() => {
        const activeElement = document.activeElement as HTMLElement | null;
        activeElement?.blur();
      });
    }
  }, [pathname]);

  useEffect(() => {
    const checkInitialAuth = async () => {
      try {
        if (!supabaseReady) {
          logger.warn('App', 'Supabase not ready, skipping session check');
          setIsCheckingAuth(false);
          setIsAuthenticated(false);
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        const hasSession = !!session;

        setIsAuthenticated(hasSession);
        lastAuthState.current = hasSession;
        setIsCheckingAuth(false);

        // Reduced logging
      } catch (err) {
        logger.error('Auth', 'Error checking session:', err);
        setIsAuthenticated(false);
        setIsCheckingAuth(false);
      }
    };

    checkInitialAuth();
  }, [pathname, supabaseReady]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        const hasSession = !!session;

        if (lastAuthState.current === hasSession) {
          return;
        }

        setIsAuthenticated(hasSession);
        lastAuthState.current = hasSession;

        if (event === 'SIGNED_IN' && hasSession) {
          navigationInitialized.current = false;
          const targetRoute = await determinePostAuthRoute();
          router.replace(targetRoute ?? ROUTES.home);
        } else if (event === 'SIGNED_OUT') {
          navigationInitialized.current = false;
          router.replace(ROUTES.auth);
        }
      }
    );
    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (isAuthenticated && Platform.OS !== 'web') {
      checkForAppUpdate().then(({ hasUpdate, isCritical, version }) => {
        if (hasUpdate && version) {
          setUpdateVersion(version);
          setIsCriticalUpdate(isCritical);
          setUpdateModalVisible(true);
        }
      });
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (notification && notification.request.content.data) {
      const data = notification.request.content.data;
      logger.info('Notification', 'Received notification in foreground:', data);

      if (data.type === 'message' && data.senderId) {
        router.push(`/messages/${data.senderId}`);
      } else if (data.type === 'proximity') {
        router.push('/radar');
      } else if (data.type === 'app_update') {
        logger.info('Notification', 'App update notification received');
        if (data.versionId && data.isCritical) {
          checkForAppUpdate().then(({ hasUpdate, isCritical, version }) => {
            if (hasUpdate && version) {
              setUpdateVersion(version);
              setIsCriticalUpdate(isCritical);
              setUpdateModalVisible(true);
            }
          });
        }
      }
    }
  }, [notification, router]);

  useEffect(() => {
    if (!fontsLoaded || isCheckingAuth || isAuthenticated === null) {
      return;
    }

    if (navigationInitialized.current) {
      return;
    }

    const currentSegment = segments[0];
    const inAuthGroup = currentSegment === 'auth' || currentSegment === 'onboarding';
    const onGetStarted = !currentSegment || currentSegment === 'index';

    if (isAuthenticated) {
      if (inAuthGroup || onGetStarted) {
        navigationInitialized.current = true;
        determinePostAuthRoute().then((targetRoute) => {
          router.replace(targetRoute ?? ROUTES.home);
        }).catch((error) => {
          logger.error('Auth', 'Failed to determine post-auth route', error);
          router.replace(ROUTES.home);
        });
      }
    } else {
      if (!inAuthGroup && !onGetStarted) {
        navigationInitialized.current = true;
        router.replace(ROUTES.landing);
      }
    }
  }, [isAuthenticated, segments, router, fontsLoaded, isCheckingAuth]);

  if (!fontsLoaded || isCheckingAuth || isAuthenticated === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const inAuthGroup = segments[0] === 'auth' || segments[0] === 'onboarding';
  const onGetStarted = !segments[0] || segments[0] === 'index';
  const shouldShowNav = isAuthenticated && !inAuthGroup && !onGetStarted;

  const handleDismissUpdate = () => {
    if (updateVersion && !isCriticalUpdate) {
      markUpdateDismissed(updateVersion.id);
      setUpdateModalVisible(false);
    }
  };

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

              <AppUpdateModal
                visible={updateModalVisible}
                version={updateVersion}
                isCritical={isCriticalUpdate}
                onDismiss={handleDismissUpdate}
              />
            </View>
          </ProfileProvider>
        </MessagingProvider>
      </VisibilityProvider>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#94a3b8',
    fontSize: 16,
  },
});

export default RootLayout;

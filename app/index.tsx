import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { createShadowStyle } from '../src/utils/shadow';
import GradientTitle from '../src/components/GradientTitle';

const BUTTON_GRADIENT = ['#2563eb', '#7e22ce'] as const;
const BUTTON_ELEVATION = createShadowStyle({
  native: {
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  web: '0 12px 16px rgba(0, 0, 0, 0.35)',
});

const GetStartedScreen: React.FC = () => {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const containerScale = useRef(new Animated.Value(1)).current;
  const containerTranslate = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    containerScale.setValue(1);
    containerTranslate.setValue(0);
    containerOpacity.setValue(1);
  }, [containerOpacity, containerScale, containerTranslate]);

  const runContainerAnimation = useCallback((isPressed: boolean) => {
    Animated.parallel([
      Animated.timing(containerScale, {
        toValue: isPressed ? 0.95 : 1,
        duration: 400,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(containerOpacity, {
        toValue: isPressed ? 0.8 : 1,
        duration: 400,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(containerTranslate, {
        toValue: isPressed ? -12 : 0,
        duration: 400,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [containerOpacity, containerScale, containerTranslate]);

  useFocusEffect(
    useCallback(() => {
      setIsNavigating(false);
      containerScale.setValue(1);
      containerTranslate.setValue(0);
      containerOpacity.setValue(1);
      if (navTimeoutRef.current) {
        clearTimeout(navTimeoutRef.current);
        navTimeoutRef.current = null;
      }
      return () => {
        if (navTimeoutRef.current) {
          clearTimeout(navTimeoutRef.current);
          navTimeoutRef.current = null;
        }
      };
    }, [containerOpacity, containerScale, containerTranslate])
  );

  const handlePress = useCallback(() => {
    if (isNavigating) {
      return;
    }

    setIsNavigating(true);
    runContainerAnimation(true);

    navTimeoutRef.current = setTimeout(() => {
      router.replace('/auth');
    }, 420);
  }, [isNavigating, router, runContainerAnimation]);

  return (
    <View style={styles.root}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: containerOpacity,
            transform: [{ scale: containerScale }, { translateY: containerTranslate }],
          },
        ]}
      >
        <GradientTitle text="Zenlit" style={styles.title} numberOfLines={1} />

        <Pressable
          accessibilityRole="button"
          disabled={isNavigating}
          onPress={handlePress}
          style={({ pressed }) => [styles.buttonWrapper, pressed ? styles.buttonPressed : null]}
        >
          <LinearGradient
            colors={BUTTON_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.button}
          >
            {isNavigating ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#ffffff" size="small" />
                <Text style={[styles.buttonLabel, styles.loadingText]}>Loading...</Text>
              </View>
            ) : (
              <Text style={styles.buttonLabel}>Get Started</Text>
            )}
          </LinearGradient>
        </Pressable>

        {/** Removed the secondary sign-in link to declutter the Get Started page */}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: 64,
    fontWeight: '600',
    letterSpacing: -1,
    textAlign: 'center',
    color: '#ffffff',
    marginBottom: 48,
  },
  buttonWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    ...BUTTON_ELEVATION,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
  },
  button: {
    paddingHorizontal: 40,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonLabel: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    marginLeft: 8,
  },
  secondaryLink: {
    marginTop: 28,
  },
  secondaryText: {
    color: '#60a5fa',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default GetStartedScreen;









import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

const TITLE_GRADIENT = ['#2563eb', '#7e22ce'] as const;
const BUTTON_GRADIENT = ['#2563eb', '#7e22ce'] as const;

const GetStartedScreen: React.FC = () => {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const containerScale = useRef(new Animated.Value(1)).current;
  const containerTranslate = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

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
        useNativeDriver: true,
      }),
      Animated.timing(containerOpacity, {
        toValue: isPressed ? 0.8 : 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(containerTranslate, {
        toValue: isPressed ? -12 : 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [containerOpacity, containerScale, containerTranslate]);

  const handlePress = useCallback(() => {
    if (isNavigating) {
      return;
    }

    setIsNavigating(true);
    runContainerAnimation(true);

    setTimeout(() => {
      router.push('/radar');
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
        <MaskedView
          style={styles.maskedTitle}
          maskElement={<Text style={styles.title}>Zenlit</Text>}
        >
          <LinearGradient colors={TITLE_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Text style={[styles.title, styles.transparentTitle]}>Zenlit</Text>
          </LinearGradient>
        </MaskedView>

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
  maskedTitle: {
    marginBottom: 48,
  },
  title: {
    fontSize: 64,
    fontWeight: '600',
    letterSpacing: -1,
    textAlign: 'center',
    color: '#ffffff',
  },
  transparentTitle: {
    color: 'transparent',
  },
  buttonWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
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
});

export default GetStartedScreen;

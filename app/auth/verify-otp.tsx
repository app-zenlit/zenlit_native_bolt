import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useRef, useCallback } from 'react';

import { createShadowStyle } from '../../src/utils/shadow';
import GradientTitle from '../../src/components/GradientTitle';
import { supabase } from '../../src/lib/supabase';

const PRIMARY_GRADIENT = ['#2563eb', '#7e22ce'] as const;
const COOLDOWN_SECONDS = 60;

export default function VerifyOTPScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const isComplete = useMemo(() => {
    return code.length === 6;
  }, [code]);

  const startCooldown = (seconds: number) => {
    setCooldown(seconds);
    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    startCooldown(COOLDOWN_SECONDS); // Start with initial cooldown
  }, []);

  const handleChange = (text: string) => {
    const numericText = text.replace(/[^0-9]/g, '');
    setCode(numericText);
    setError('');
    setStatus('');
  };

  const handleVerify = async () => {
    if (!isComplete || verifying) {
      return;
    }
    setVerifying(true);
    setError('');
    setStatus('');

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email || '',
        token: code,
        type: 'email'
      });

      if (error) {
        setError(error.message);
        setVerifying(false);
        return;
      }

      if (data.user) {
        // Check if user has completed profile setup
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profile) {
          // Profile exists, go to radar
          router.replace('/radar');
        } else {
          // Profile doesn't exist, go to onboarding
          router.replace('/onboarding/profile/basic');
        }
      } else {
        setError('Verification failed. Please try again.');
        setVerifying(false);
      }
    } catch (error) {
      setError('Something went wrong. Please try again.');
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) {
      return;
    }
    setResending(true);
    setError('');
    setStatus('');

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email || '',
        options: {
          shouldCreateUser: true,
        }
      });

      if (error) {
        setError(error.message);
        setResending(false);
        return;
      }

      setStatus('We sent a new code to your inbox.');
      startCooldown(COOLDOWN_SECONDS);
      setResending(false);
    } catch (error) {
      setError('Failed to resend code. Please try again.');
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={styles.root}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/auth')}
              style={styles.backButton}
            >
              <Feather name="arrow-left" size={20} color="#ffffff" />
            </Pressable>
          </View>

          <View style={styles.brandSection}>
            <GradientTitle text="Zenlit" style={styles.brandTitle} />
            <Text style={styles.brandSubtitle}>Connect with people around you</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.infoBanner}>
              <Feather name="mail" size={18} color="#60a5fa" />
              <Text style={styles.infoText}>
                Check your inbox at <Text style={styles.infoTextStrong}>{email || 'your email'}</Text>
              </Text>
            </View>

            {status ? <Text style={styles.statusText}>{status}</Text> : null}
            {error ? (
              <Text style={[styles.errorText, status ? styles.errorWithStatus : null]}>{error}</Text>
            ) : null}

            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>Enter the 6-digit code</Text>
              <View style={styles.otpWrapper}>
                <TextInput
                  value={code}
                  onChangeText={handleChange}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  style={styles.otpInput}
                />
                {code.length === 0 ? (
                  <Text style={styles.ghostCode}>123456</Text>
                ) : null}
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={!isComplete || verifying}
              onPress={handleVerify}
              style={({ pressed }) => [
                styles.primaryButton,
                (!isComplete || verifying) ? styles.disabled : null,
                pressed && isComplete && !verifying ? styles.primaryButtonPressed : null,
              ]}
            >
              <LinearGradient
                colors={PRIMARY_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryGradient}
              >
                <Text style={styles.primaryLabel}>
                  {verifying ? 'Verifying...' : 'Verify & Continue'}
                </Text>
              </LinearGradient>
            </Pressable>

            <View style={styles.resendBlock}>
              {cooldown > 0 ? (
                <Text style={styles.cooldownText}>
                  Resend code available in <Text style={styles.cooldownStrong}>{cooldown}s</Text>
                </Text>
              ) : (
                <Pressable accessibilityRole="button" onPress={handleResend}>
                  <Text style={styles.resendLink}>
                    {resending ? 'Sending...' : 'Resend code'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    alignItems: 'center',
  },
  topBar: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  brandTitle: {
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  brandSubtitle: {
    marginTop: 6,
    fontSize: 16,
    color: '#94a3b8',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderRadius: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    shadowColor: '#000000',
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 18 },
    elevation: 24,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.4)',
    backgroundColor: 'rgba(30, 58, 138, 0.35)',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#cbd5f5',
  },
  infoTextStrong: {
    color: '#ffffff',
    fontWeight: '600',
  },
  statusText: {
    marginTop: 16,
    fontSize: 13,
    textAlign: 'center',
    color: '#60a5fa',
  },
  errorText: {
    marginTop: 16,
    fontSize: 13,
    textAlign: 'center',
    color: '#fca5a5',
  },
  errorWithStatus: {
    marginTop: 8,
  },
  inputBlock: {
    marginTop: 24,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5f5',
    marginBottom: 12,
  },
  otpWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignSelf: 'center',
    alignItems: 'center',
    width: 260,
    maxWidth: 260,
  },
  otpInput: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.45)',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: 12,
    textAlign: 'center',
    paddingVertical: 12,
    width: '100%',
    height: 52,
    flexShrink: 0,
  },
  ghostCode: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: 12,
    color: 'rgba(148, 163, 184, 0.25)',
    textTransform: 'none',
    textAlignVertical: 'center',
    lineHeight: 48,
    // Ensure overlay does not block input interaction
    pointerEvents: 'none' as unknown as undefined,
  },
  primaryButton: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 32,
  },
  primaryButtonPressed: {
    transform: [{ scale: 0.99 }],
  },
  primaryGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  primaryLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.6,
  },
  resendBlock: {
    marginTop: 24,
    alignItems: 'center',
  },
  cooldownText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  cooldownStrong: {
    color: '#ffffff',
    fontWeight: '600',
  },
  resendLink: {
    fontSize: 13,
    color: '#60a5fa',
    fontWeight: '600',
  },
});

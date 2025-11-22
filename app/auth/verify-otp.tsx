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
import { supabase, supabaseReady } from '../../src/lib/supabase';
import { logger } from '../../src/utils/logger';
import { determinePostAuthRoute } from '../../src/utils/authNavigation';

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

    if (!supabaseReady) {
      logger.error('Auth', 'Supabase not configured for OTP verification');
      setError('Authentication service is not available. Please contact support.');
      return;
    }

    const maskedEmail = (email || '').replace(/(.{2})(.*)(@.*)/, '$1***$3');

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
        logger.error('Auth', 'OTP verification failed', {
          email: maskedEmail,
          errorName: error.name,
          errorMessage: error.message,
        });

        let userMessage = error.message;

        if (error.message.includes('expired') || error.message.includes('invalid')) {
          userMessage = 'This code has expired or is invalid. Please request a new code.';
        } else if (error.message.includes('not found')) {
          userMessage = 'Invalid verification code. Please check and try again.';
        }

        setError(userMessage);
        setVerifying(false);
        return;
      }

      if (data.user) {
        const targetRoute = await determinePostAuthRoute({ userId: data.user.id });
        // Use replace to prevent going back to OTP screen
        router.replace(targetRoute ?? '/onboarding/profile/basic');
      } else {
        logger.error('Auth', 'OTP verification returned no user');
        setError('Verification failed. Please try again.');
        setVerifying(false);
      }
    } catch (error: any) {
      logger.error('Auth', 'OTP verification exception', {
        email: maskedEmail,
        error: error?.message || String(error),
      });
      setError('Something went wrong. Please try again.');
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) {
      return;
    }

    const maskedEmail = (email || '').replace(/(.{2})(.*)(@.*)/, '$1***$3');

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
        logger.error('Auth', 'OTP resend failed', {
          email: maskedEmail,
          errorMessage: error.message,
        });

        let userMessage = error.message;

        if (error.message.includes('rate limit') || error.message.includes('too many')) {
          userMessage = 'Too many attempts. Please wait a few minutes before requesting a new code.';
        }

        setError(userMessage);
        setResending(false);
        return;
      }

      setStatus('We sent a new code to your inbox.');
      startCooldown(COOLDOWN_SECONDS);
      setResending(false);
    } catch (error: any) {
      logger.error('Auth', 'OTP resend exception', {
        email: maskedEmail,
        error: error?.message || String(error),
      });
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
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Feather name="arrow-left" size={24} color="#ffffff" />
            </Pressable>
          </View>

          <View style={styles.brandSection}>
            <GradientTitle text="Zenlit" style={styles.brandTitle} />
            <Text style={styles.brandSubtitle}>Verify your identity</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.infoBanner}>
              <Feather name="mail" size={18} color="#60a5fa" />
              <Text style={styles.infoText}>
                Code sent to <Text style={styles.infoTextStrong}>{email || 'your email'}</Text>
              </Text>
            </View>

            {status ? <Text style={styles.statusText}>{status}</Text> : null}
            {error ? (
              <Text style={[styles.errorText, status ? styles.errorWithStatus : null]}>{error}</Text>
            ) : null}

            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>Enter 6-digit code</Text>
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
                  <Text style={styles.ghostCode}>000000</Text>
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
                  Resend code in <Text style={styles.cooldownStrong}>{cooldown}s</Text>
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
}

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
    maxWidth: 400,
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 32,
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
    maxWidth: 400,
    paddingHorizontal: 24,
    paddingVertical: 32,
    borderRadius: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
    backgroundColor: 'rgba(30, 58, 138, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#cbd5f5',
    lineHeight: 20,
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
    marginTop: 32,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5f5',
    marginBottom: 12,
    textAlign: 'center',
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
    borderColor: 'rgba(148, 163, 184, 0.3)',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: 14,
    textAlign: 'center',
    paddingVertical: 12,
    width: '100%',
    height: 64,
    flexShrink: 0,
  },
  ghostCode: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: 14,
    color: 'rgba(148, 163, 184, 0.15)',
    textTransform: 'none',
    textAlignVertical: 'center',
    lineHeight: 60,
    pointerEvents: 'none' as unknown as undefined,
  },
  primaryButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 32,
  },
  primaryButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  primaryGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  primaryLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  disabled: {
    opacity: 0.5,
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

import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
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
import { useRouter } from 'expo-router';

import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { createShadowStyle } from '../../../src/utils/shadow';
import GradientTitle from '../../../src/components/GradientTitle';
import { supabase } from '../../../src/lib/supabase';
import { validateProfileData, validateDateOfBirth, validateUsername, validateDisplayName, checkUsernameAvailability, formatDate, parseDobString, normalizeGender, type ProfileData } from '../../../src/utils/profileValidation';
import UsernameSuggestions from '../../../src/components/UsernameSuggestions';


const PRIMARY_GRADIENT = ['#2563eb', '#7e22ce'] as const;
const GENDERS = ['Male', 'Female', 'Others'] as const;
const WEB_DATE_INPUT_STYLE: CSSProperties = {
  width: '100%',
  border: 'none',
  outline: 'none',
  backgroundColor: 'transparent',
  color: '#ffffff',
  fontSize: 16,
  padding: '14px 16px',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  cursor: 'pointer',
};
const WEB_DATE_INPUT_OVERLAY_STYLE: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100%',
  height: '100%',
  opacity: 0,
  cursor: 'pointer',
  borderRadius: 16,
  border: 'none',
  outline: 'none',
  backgroundColor: 'transparent',
};

const OnboardingBasicScreen: React.FC = () => {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [dob, setDob] = useState('');
  const [dobDate, setDobDate] = useState<Date | null>(null);
  const [showIosPicker, setShowIosPicker] = useState(false);
  const [gender, setGender] = useState<typeof GENDERS[number] | ''>('');
  const webDateInputRef = useRef<HTMLInputElement | null>(null);
  const [isWebDateFocused, setIsWebDateFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({ displayName: '', username: '', dob: '', gender: '' });
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const usernameCheckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const maxDobDate = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);
  const maxDobInputValue = useMemo(() => formatDate(maxDobDate), [maxDobDate]);

  const resolvedDobDate = useMemo(() => {
    if (dobDate) {
      return dobDate;
    }
    const parsed = parseDobString(dob);
    if (parsed) {
      return parsed;
    }
    const fallback = new Date();
    fallback.setFullYear(fallback.getFullYear() - 18);
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }, [dob, dobDate]);

  const updateDob = (date: Date) => {
    const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    normalized.setHours(0, 0, 0, 0);
    setDobDate(normalized);
    setDob(formatDate(normalized));
  };

  const handleDobWebChange = (value: string) => {
    if (!value) {
      setDob('');
      setDobDate(null);
      return;
    }
    const parsed = parseDobString(value);
    if (parsed) {
      updateDob(parsed);
      return;
    }
    const fallback = value.slice(0, 10);
    setDob(fallback);
    setDobDate(null);
  };

  const openDobPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        mode: 'date',
        value: resolvedDobDate,
        maximumDate: maxDobDate,
        onChange: (_event: DateTimePickerEvent, selectedDate?: Date) => {
          if (selectedDate) {
            updateDob(selectedDate);
          }
        },
      });
      return;
    }

    if (Platform.OS === 'ios') {
      setShowIosPicker(true);
    }
  };

  const handleIosDobChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) {
      updateDob(selectedDate);
    }
  };

  const closeIosPicker = () => {
    setShowIosPicker(false);
  };

  const isFilled = useMemo(() => {
    const hasDisplayName = displayName.trim().length > 0;
    const hasUsername = username.trim().length > 0;
    const hasDob = dob.trim().length > 0 || !!dobDate;
    const hasGender = gender.trim().length > 0;
    const isUsernameValid = usernameAvailable === true && !isCheckingUsername;
    return hasDisplayName && hasUsername && hasDob && hasGender && isUsernameValid;
  }, [displayName, username, dob, dobDate, gender, usernameAvailable, isCheckingUsername]);

  const validateForm = (): boolean => {
    const nextErrors = { displayName: '', username: '', dob: '', gender: '' };

    const dnRes = validateDisplayName(displayName.trim());
    if (!dnRes.isValid) {
      nextErrors.displayName = dnRes.error || 'Display name is invalid';
    }

    const unRes = validateUsername(username.trim());
    if (!unRes.isValid) {
      nextErrors.username = unRes.error || 'Username is invalid';
    }

    if (!(dob.trim().length > 0 || dobDate)) {
      nextErrors.dob = 'Date of birth is required';
    } else {
      const dobStr = dobDate ? formatDate(dobDate) : dob;
      const dobRes = validateDateOfBirth(dobStr);
      if (!dobRes.isValid) {
        nextErrors.dob = dobRes.error || 'Date of birth is invalid';
      }
    }

    if (!gender.trim().length) {
      nextErrors.gender = 'Please select your gender';
    }

    setErrors(nextErrors);
    return !nextErrors.displayName && !nextErrors.username && !nextErrors.dob && !nextErrors.gender;
  };

  const checkUsername = useCallback(async (usernameToCheck: string) => {
    if (!usernameToCheck || usernameToCheck.length < 3) {
      setUsernameAvailable(null);
      setUsernameSuggestions([]);
      return;
    }

    const validation = validateUsername(usernameToCheck);
    if (!validation.isValid) {
      setUsernameAvailable(null);
      setUsernameSuggestions([]);
      return;
    }

    setIsCheckingUsername(true);
    try {
      const result = await checkUsernameAvailability(usernameToCheck);
      console.log('Username check result:', { username: usernameToCheck, available: result.isAvailable, suggestions: result.suggestions });
      setUsernameAvailable(result.isAvailable);
      setUsernameSuggestions(result.suggestions || []);
    } catch (error) {
      console.error('Error checking username:', error);
      setUsernameAvailable(null);
      setUsernameSuggestions([]);
    } finally {
      setIsCheckingUsername(false);
    }
  }, []);

  useEffect(() => {
    if (usernameCheckTimeoutRef.current) {
      clearTimeout(usernameCheckTimeoutRef.current);
    }

    if (username.trim().length >= 3) {
      usernameCheckTimeoutRef.current = setTimeout(() => {
        checkUsername(username.trim());
      }, 500);
    } else {
      setUsernameAvailable(null);
      setUsernameSuggestions([]);
    }

    return () => {
      if (usernameCheckTimeoutRef.current) {
        clearTimeout(usernameCheckTimeoutRef.current);
      }
    };
  }, [username, checkUsername]);

  const handleUsernameChange = (value: string) => {
    const sanitized = value.replace(/[^a-zA-Z0-9_.-]/g, '').toLowerCase();
    setUsername(sanitized);
    if (errors.username) setErrors((e) => ({ ...e, username: '' }));
  };

  const handleSuggestionSelect = (suggestion: string) => {
    setUsername(suggestion);
    setUsernameSuggestions([]);
    setUsernameAvailable(true);
    if (errors.username) setErrors((e) => ({ ...e, username: '' }));
  };

  const handleContinue = async () => {
    if (!isFilled || isSubmitting) {
      return;
    }

    if (usernameAvailable !== true) {
      Alert.alert('Username Unavailable', 'Please choose an available username.');
      return;
    }

    const isValid = validateForm();
    if (!isValid) {
      return;
    }

    const normalizedGender = normalizeGender(gender);

    const dobValue = dobDate ? formatDate(dobDate) : dob;

    const profileData: ProfileData = {
      display_name: displayName.trim(),
      user_name: username.trim().toLowerCase(),
      date_of_birth: dobValue,
      gender: normalizedGender,
    };

    const validation = validateProfileData(profileData);
    if (!validation.isValid) {
      // Surface general errors via Alert, but keep inline errors for fields
      Alert.alert('Validation Error', validation.error);
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          display_name: profileData.display_name,
          user_name: profileData.user_name,
          date_of_birth: profileData.date_of_birth,
          gender: profileData.gender,
          email: user.email,
        });

      if (profileError) {
        if ((profileError as any).code === '23505') {
          Alert.alert('Username Unavailable', 'That username is already taken. Please choose another.');
          return;
        }
        throw profileError;
      }

      router.replace('/onboarding/profile/complete');
    } catch (err: any) {
      console.error('Error saving profile:', err);
      Alert.alert('Save Failed', err?.message || 'Could not save your profile. Please try again.');
    } finally {
      setIsSubmitting(false);
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
          <View style={styles.brandSection}>
            <GradientTitle text="Zenlit" style={styles.brandTitle} />
            <Text style={styles.brandSubtitle}>Step 1 of 2</Text>
            <Text style={styles.onboardingSubtitle}>Let's set up your presence</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Display Name</Text>
              <TextInput
                value={displayName}
                onChangeText={(v) => {
                  setDisplayName(v);
                  if (errors.displayName) setErrors((e) => ({ ...e, displayName: '' }));
                }}
                placeholder="How should we call you?"
                placeholderTextColor="rgba(148, 163, 184, 0.7)"
                style={styles.input}
              />
              {errors.displayName ? <Text style={styles.errorText}>{errors.displayName}</Text> : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Username</Text>
              <View style={styles.usernameInputWrapper}>
                <TextInput
                  value={username}
                  onChangeText={handleUsernameChange}
                  placeholder="username"
                  placeholderTextColor="rgba(148, 163, 184, 0.7)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[
                    styles.input,
                    usernameAvailable === true && styles.inputSuccess,
                    usernameAvailable === false && styles.inputError,
                  ]}
                />
                {isCheckingUsername && (
                  <View style={styles.usernameStatusIcon}>
                    <Feather name="loader" size={18} color="#60a5fa" />
                  </View>
                )}
                {!isCheckingUsername && usernameAvailable === true && (
                  <View style={styles.usernameStatusIcon}>
                    <Feather name="check-circle" size={18} color="#10b981" />
                  </View>
                )}
                {!isCheckingUsername && usernameAvailable === false && (
                  <View style={styles.usernameStatusIcon}>
                    <Feather name="x-circle" size={18} color="#ef4444" />
                  </View>
                )}
              </View>
              {!isCheckingUsername && usernameAvailable !== false && (
                <Text style={styles.helperText}>Only lowercase letters, numbers, dots, and underscores.</Text>
              )}
              {isCheckingUsername && (
                <Text style={styles.checkingText}>Checking availability...</Text>
              )}
              {!isCheckingUsername && usernameAvailable === true && (
                <Text style={styles.successText}>Username is available!</Text>
              )}
              {!isCheckingUsername && usernameAvailable === false && (
                <Text style={styles.errorText}>Username '{username}' is already taken. Try one of these:</Text>
              )}
              {errors.username && !isCheckingUsername && usernameAvailable !== false ? <Text style={styles.errorText}>{errors.username}</Text> : null}
              {!isCheckingUsername && usernameAvailable === false && usernameSuggestions.length > 0 && (
                <UsernameSuggestions
                  suggestions={usernameSuggestions}
                  onSelectSuggestion={handleSuggestionSelect}
                />
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Date of Birth</Text>
              {Platform.OS === 'web' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Select date of birth"
                  onPress={() => {
                    const el = webDateInputRef.current;
                    if (el) {
                      try {
                        const anyEl = el as unknown as { showPicker?: () => void; focus: () => void };
                        if (typeof anyEl.showPicker === 'function') {
                          anyEl.showPicker();
                        } else {
                          el.focus();
                        }
                      } catch {
                        el.focus();
                      }
                    }
                  }}
                  style={({ pressed }) => [
                    styles.pickerField,
                    isWebDateFocused ? styles.pickerFieldFocused : null,
                    pressed ? styles.pickerFieldPressed : null,
                  ]}
                >
                  <View style={styles.pickerRow}>
                    <Text style={dob ? styles.dobValue : styles.dobPlaceholder}>
                      {dob || 'YYYY-MM-DD'}
                    </Text>
                    <Feather name="calendar" size={24} color="#ffffff" style={styles.pickerIcon} />
                  </View>
                  <input
                    ref={webDateInputRef}
                    type="date"
                    value={dob}
                    onChange={(event) => handleDobWebChange(event.target.value)}
                    max={maxDobInputValue}
                    style={WEB_DATE_INPUT_OVERLAY_STYLE}
                    onFocus={() => setIsWebDateFocused(true)}
                    onBlur={() => setIsWebDateFocused(false)}
                    aria-label="Date of Birth"
                  />
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Select date of birth"
                  onPress={openDobPicker}
                  style={({ pressed }) => [
                    styles.pickerField,
                    pressed ? styles.pickerFieldPressed : null,
                  ]}
                >
                  <View style={styles.pickerRow}>
                    <Text style={dob ? styles.dobValue : styles.dobPlaceholder}>
                      {dob || 'YYYY-MM-DD'}
                    </Text>
                    <Feather name="calendar" size={24} color="#ffffff" style={styles.pickerIcon} />
                  </View>
                </Pressable>
              )}
              {errors.dob ? <Text style={styles.errorText}>{errors.dob}</Text> : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Gender</Text>
              <View style={styles.genderRow}>
                {GENDERS.map((option) => {
                  const isSelected = option === gender;
                  return (
                    <Pressable
                      key={option}
                      accessibilityRole="button"
                      onPress={() => {
                        setGender(option);
                        if (errors.gender) setErrors((e) => ({ ...e, gender: '' }));
                      }}
                      style={[styles.genderPill, isSelected ? styles.genderPillActive : null]}
                    >
                      <Text style={[styles.genderLabel, isSelected ? styles.genderLabelActive : null]}>{option}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {errors.gender ? <Text style={styles.errorText}>{errors.gender}</Text> : null}
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={!isFilled || isSubmitting}
              onPress={handleContinue}
              style={({ pressed }) => [
                styles.primaryButton,
                (!isFilled || isSubmitting) ? styles.disabled : null,
                pressed && isFilled && !isSubmitting ? styles.primaryButtonPressed : null,
              ]}
            >
              <LinearGradient
                colors={PRIMARY_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryGradient}
              >
                <Text style={styles.primaryLabel}>Continue</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </ScrollView>

        {Platform.OS === 'ios' ? (
          <Modal
            animationType="fade"
            transparent
            visible={showIosPicker}
            onRequestClose={closeIosPicker}
          >
            <View style={styles.iosPickerOverlay}>
              <Pressable style={styles.iosBackdrop} onPress={closeIosPicker} />
              <View style={styles.iosPickerSheet}>
                <View style={styles.iosPickerToolbar}>
                  <Pressable accessibilityRole="button" onPress={closeIosPicker}>
                    <Text style={styles.iosPickerAction}>Done</Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  mode="date"
                  display="spinner"
                  value={resolvedDobDate}
                  onChange={handleIosDobChange}
                  maximumDate={maxDobDate}
                  themeVariant="dark"
                  style={styles.iosPicker}
                />
              </View>
            </View>
          </Modal>
        ) : null}
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
    maxWidth: 400,
    alignItems: 'flex-start',
    marginBottom: 12,
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
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
    textAlign: 'center',
  },
  onboardingSubtitle: {
    marginTop: 4,
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderRadius: 26,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    ...createShadowStyle({
      native: {
        shadowColor: '#000000',
        shadowOpacity: 0.55,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 18 },
        elevation: 22,
      },
    }),
  },
  fieldGroup: {
    marginTop: 24,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cbd5f5',
    marginBottom: 10,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.45)',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    color: '#ffffff',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 48,
  },
  pickerField: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.45)',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'center',
    overflow: 'hidden',
    minHeight: 48,
  },
  pickerFieldPressed: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
  },
  pickerFieldFocused: {
    borderColor: 'rgba(96, 165, 250, 0.7)',
  },
  webDateWrapper: {},
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerIcon: {
    marginLeft: 12,
  },
  dobValue: {
    color: '#ffffff',
    fontSize: 16,
  },
  dobPlaceholder: {
    color: 'rgba(148, 163, 184, 0.7)',
    fontSize: 16,
  },
  usernameInputWrapper: {
    position: 'relative',
  },
  usernameStatusIcon: {
    position: 'absolute',
    right: 16,
    top: 15,
  },
  inputSuccess: {
    borderColor: 'rgba(16, 185, 129, 0.5)',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  inputError: {
    borderColor: 'rgba(239, 68, 68, 0.5)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    color: '#94a3b8',
  },
  checkingText: {
    marginTop: 6,
    fontSize: 12,
    color: '#60a5fa',
  },
  successText: {
    marginTop: 6,
    fontSize: 12,
    color: '#10b981',
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    color: '#fca5a5',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 12,
  },
  genderPill: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  genderPillActive: {
    borderColor: 'rgba(96, 165, 250, 0.7)',
    backgroundColor: 'rgba(30, 64, 175, 0.35)',
  },
  genderLabel: {
    fontSize: 14,
    color: '#cbd5f5',
    fontWeight: '600',
  },
  genderLabelActive: {
    color: '#ffffff',
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
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  disabled: {
    opacity: 0.6,
  },
  iosPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  iosBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  iosPickerSheet: {
    backgroundColor: '#0f172a',
    paddingBottom: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  iosPickerToolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.1)',
  },
  iosPickerAction: {
    color: '#60a5fa',
    fontSize: 16,
    fontWeight: '600',
  },
  iosPicker: {
    height: 200,
    backgroundColor: '#0f172a',
  },
});

export default OnboardingBasicScreen;

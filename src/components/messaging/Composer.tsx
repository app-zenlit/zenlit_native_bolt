import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { gradientColors, theme } from '../../styles/theme';

export type ComposerProps = {
  onSend: (value: string) => void;
  disabled?: boolean;
  onTypingChange?: (isTyping: boolean) => void;
};

const Composer: React.FC<ComposerProps> = ({ onSend, disabled = false, onTypingChange }) => {
  const [value, setValue] = useState('');
  const canSend = useMemo(() => !disabled && value.trim().length > 0, [disabled, value]);
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTyping = useCallback(() => {
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTypingChange?.(false);
    }
  }, [onTypingChange]);

  const handleTextChange = useCallback((text: string) => {
    setValue(text);

    if (disabled || !onTypingChange) {
      return;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (text.trim().length > 0) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        onTypingChange(true);
      }

      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, 2000);
    } else {
      stopTyping();
    }
  }, [disabled, onTypingChange, stopTyping]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      stopTyping();
    };
  }, [stopTyping]);

  const handleSend = () => {
    if (!canSend) {
      return;
    }
    const trimmed = value.trim();
    stopTyping();
    onSend(trimmed);
    setValue('');
  };

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <View style={[styles.inputWrapper, disabled ? styles.inputDisabled : null]}>
          <TextInput
            style={[styles.input, disabled ? styles.inputTextDisabled : null]}
            value={value}
            onChangeText={handleTextChange}
            placeholder={disabled ? 'Chat is read-only.' : 'Type a message...'}
            placeholderTextColor={disabled ? theme.colors.iconInactive : '#9ca3af'}
            editable={!disabled}
            multiline
            numberOfLines={1}
            maxLength={800}
            textAlignVertical="center"
          />
        </View>
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          style={({ pressed }) => [
            styles.sendButtonTouchable,
            !canSend ? styles.sendButtonTouchableDisabled : null,
            pressed && canSend ? styles.sendButtonTouchablePressed : null,
          ]}
        >
          {canSend ? (
            <LinearGradient colors={['#2563eb', '#7e22ce']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sendButton}>
              <Feather name="arrow-up" size={20} color="#ffffff" />
            </LinearGradient>
          ) : (
            <View style={[styles.sendButton, styles.sendButtonDisabled]}>
              <Feather name="arrow-up" size={20} color={theme.colors.iconInactive} />
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    backgroundColor: '#000000',
    paddingBottom: 16,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  inputWrapper: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: '#1f2937', // Gray-800
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  inputDisabled: {
    opacity: 0.6,
    backgroundColor: '#111827',
  },
  input: {
    minHeight: 24,
    maxHeight: 100,
    paddingVertical: 0,
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  inputTextDisabled: {
    color: theme.colors.iconInactive,
  },
  sendButtonTouchable: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sendButtonTouchableDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  sendButtonTouchablePressed: {
    transform: [{ scale: 0.92 }],
  },
  sendButton: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  sendButtonDisabled: {
    backgroundColor: '#1f2937',
  },
});

export default Composer;

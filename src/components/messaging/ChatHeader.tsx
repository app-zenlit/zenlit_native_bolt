import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { theme } from '../../styles/theme';
import { createShadowStyle } from '../../utils/shadow';

const AVATAR_SIZE = 36; // slightly smaller than before for compact header
const TOUCH_SIZE = theme.header.touchSize;
const ICON_SIZE = theme.header.iconSize;
const ICON_HIT_SLOP = { top: 6, bottom: 6, left: 6, right: 6 } as const;

export type ChatHeaderProps = {
  title: string;
  subtitle?: string;
  avatarUrl?: string;
  isAnonymous?: boolean;
  profileId?: string;
  isOnline?: boolean;
  isTyping?: boolean;
};

const ChatHeader: React.FC<ChatHeaderProps> = ({ title, subtitle, avatarUrl, isAnonymous = false, profileId, isOnline = false, isTyping = false }) => {
  const router = useRouter();
  const initial = title?.trim().charAt(0)?.toUpperCase() ?? 'C';
  const displaySubtitle = isTyping ? 'typing...' : subtitle || (isOnline ? 'online' : '');

  const shadowStyle = createShadowStyle({
    native: {
      shadowColor: '#000000',
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
  });

  return (
    <View style={[styles.wrapper, shadowStyle]}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.inner}>
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && styles.iconPressed]}
            android_ripple={{ color: 'rgba(255, 255, 255, 0.12)' }}
            accessibilityRole="button"
            accessibilityLabel="Back to messages"
            onPress={() => router.back()}
            hitSlop={ICON_HIT_SLOP}
          >
            <Feather name="arrow-left" size={ICON_SIZE} color={theme.colors.icon} />
          </Pressable>

          <View style={styles.profileRow}>
            <View style={styles.avatarContainer}>
              <Pressable
                style={({ pressed }) => [styles.avatarFrame, pressed && !isAnonymous ? styles.avatarPressed : null]}
                android_ripple={{ color: isAnonymous ? 'transparent' : 'rgba(255, 255, 255, 0.12)' }}
                accessibilityRole="button"
                accessibilityLabel={isAnonymous ? "Anonymous user" : "View user profile"}
                accessibilityState={{ disabled: isAnonymous || !profileId }}
                disabled={isAnonymous || !profileId}
                onPress={() => !isAnonymous && profileId && router.push(`/profile/${profileId}`)}
              >
                {avatarUrl && !isAnonymous ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarFallback}>
                    {isAnonymous ? (
                      <Feather name="user" size={20} color={theme.colors.icon} />
                    ) : (
                      <Text style={styles.avatarInitial}>{initial}</Text>
                    )}
                  </View>
                )}
              </Pressable>
              {isOnline && !isAnonymous && (
                <View style={styles.onlineIndicator} />
              )}
            </View>

            <View style={styles.textBlock}>
              <Pressable
                style={({ pressed }) => [styles.namePressable, pressed && !isAnonymous ? styles.textPressed : null]}
                android_ripple={{ color: isAnonymous ? 'transparent' : 'rgba(255, 255, 255, 0.12)' }}
                accessibilityRole="button"
                accessibilityLabel={isAnonymous ? "Anonymous user" : "View user profile"}
                accessibilityState={{ disabled: isAnonymous || !profileId }}
                disabled={isAnonymous || !profileId}
                onPress={() => !isAnonymous && profileId && router.push(`/profile/${profileId}`)}
              >
                <Text
                  style={[styles.title, { color: theme.colors.text }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {title}
                </Text>
              </Pressable>
              {displaySubtitle ? (
                <Text style={[styles.subtitle, isTyping && styles.subtitleTyping]} numberOfLines={1}>
                  {displaySubtitle}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.trailingSpace} />
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: theme.colors.headerBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    marginBottom: 10,
  },
  safeArea: {
    backgroundColor: theme.colors.headerBackground,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.header.paddingHorizontal,
    paddingTop: 2,
    paddingBottom: 2,
    minHeight: theme.header.height,
  },
  backButton: {
    width: TOUCH_SIZE,
    height: TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPressed: {
    opacity: 0.6,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginHorizontal: theme.header.contentSpacing,
    gap: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarFrame: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: theme.colors.headerBackground,
  },
  avatarPressed: {
    opacity: 0.85,
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  textBlock: {
    flex: 1,
  },
  namePressable: {
    alignSelf: 'flex-start',
  },
  textPressed: {
    opacity: 0.85,
  },
  title: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.muted,
    marginTop: 2,
  },
  subtitleTyping: {
    color: '#22c55e',
    fontStyle: 'italic',
  },
  trailingSpace: {
    width: TOUCH_SIZE,
    height: TOUCH_SIZE,
  },
});

export default ChatHeader;

import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { theme } from '../../styles/theme';
import { createShadowStyle } from '../../utils/shadow';

const AVATAR_SIZE = 40;
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
      shadowOpacity: 0.4,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
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
            <Feather name="arrow-left" size={24} color="#ffffff" />
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
                  <LinearGradient
                    colors={['#3b82f6', '#2563eb']}
                    style={styles.avatarFallback}
                  >
                    {isAnonymous ? (
                      <Feather name="user" size={20} color="#ffffff" />
                    ) : (
                      <Text style={styles.avatarInitial}>{initial}</Text>
                    )}
                  </LinearGradient>
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
                  style={styles.title}
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
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    zIndex: 10,
  },
  safeArea: {
    backgroundColor: '#000000',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    minHeight: 56,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  iconPressed: {
    opacity: 0.6,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 12,
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#1f2937',
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
    borderColor: '#000000',
  },
  avatarPressed: {
    opacity: 0.85,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  textBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  namePressable: {
    alignSelf: 'flex-start',
  },
  textPressed: {
    opacity: 0.85,
  },
  title: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
    fontWeight: '500',
  },
  subtitleTyping: {
    color: '#22c55e',
    fontStyle: 'italic',
    fontWeight: '600',
  },
  trailingSpace: {
    width: 40,
    height: 40,
  },
});

export default ChatHeader;

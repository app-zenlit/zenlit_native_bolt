import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export type ChatListItemProps = {
  title: string;
  subtitle: string;
  timeLabel: string;
  unreadCount?: number;
  avatarUrl?: string;
  isAnonymous?: boolean;
  onPress: () => void;
};

const ChatListItem: React.FC<ChatListItemProps> = ({
  title,
  subtitle,
  timeLabel,
  unreadCount,
  avatarUrl,
  isAnonymous = false,
  onPress,
}) => {
  const hasUnread = !!unreadCount && unreadCount > 0;
  const unreadLabel = hasUnread ? (unreadCount > 99 ? '99+' : String(unreadCount)) : '';
  const accessibilityLabelParts = [
    isAnonymous ? 'Anonymous' : title,
    subtitle,
    timeLabel,
  ].filter(Boolean);
  if (hasUnread) {
    accessibilityLabelParts.push(
      unreadCount === 1 ? '1 unread message' : `${unreadLabel} unread messages`,
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed ? styles.containerPressed : null,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabelParts.join(', ')}
    >
      <View style={styles.avatarFrame}>
        {avatarUrl && !isAnonymous ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
        ) : (
          <LinearGradient
            colors={['#3b82f6', '#2563eb']}
            style={styles.avatarFallback}
          >
            <Feather name="user" size={24} color="#ffffff" />
          </LinearGradient>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.primaryRow}>
          <Text style={[styles.title, hasUnread && styles.titleUnread]} numberOfLines={1}>
            {isAnonymous ? 'Anonymous' : title}
          </Text>
          <Text style={[styles.time, hasUnread && styles.timeUnread]} numberOfLines={1}>
            {timeLabel}
          </Text>
        </View>
        <View style={styles.secondaryRow}>
          <Text
            style={[styles.subtitle, hasUnread && styles.subtitleUnread]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {subtitle}
          </Text>
          {hasUnread ? (
            <LinearGradient
              colors={['#3b82f6', '#2563eb']}
              style={styles.unreadBadge}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.unreadText}>{unreadLabel}</Text>
            </LinearGradient>
          ) : (
            <Feather name="chevron-right" size={16} color="rgba(148,163,184,0.4)" />
          )}
        </View>
      </View>
    </Pressable>
  );
};

const AVATAR_SIZE = 50;
const AVATAR_RADIUS = AVATAR_SIZE / 2;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    paddingVertical: 14,
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  containerPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  avatarFrame: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_RADIUS,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
  content: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  primaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: '#e2e8f0', // Slate-200
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
    fontFamily: 'Inter_600SemiBold',
  },
  titleUnread: {
    color: '#ffffff',
    fontWeight: '700',
  },
  time: {
    color: '#64748b', // Slate-500
    fontSize: 12,
    fontWeight: '500',
  },
  timeUnread: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  subtitle: {
    color: '#94a3b8', // Slate-400
    fontSize: 14,
    flex: 1,
    marginRight: 12,
    lineHeight: 20,
  },
  subtitleUnread: {
    color: '#e2e8f0',
    fontWeight: '500',
  },
  unreadBadge: {
    minWidth: 22,
    paddingHorizontal: 6,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
});

export default ChatListItem;

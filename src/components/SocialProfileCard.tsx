import React, { useMemo } from 'react';
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MessageSquare, User } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import type { NearbyUserData } from '../services';
import {
  DEFAULT_VISIBLE_PLATFORMS,
  SOCIAL_PLATFORMS,
  ensureSocialUrl,
  getTwitterHandle,
  type SocialLinks,
  type SocialPlatformId,
} from '../constants/socialPlatforms';

const FALLBACK_AVATAR =
  'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';

const INSTAGRAM_GRADIENT = [
  '#f09433',
  '#e6683c',
  '#dc2743',
  '#cc2366',
  '#bc1888',
] as const;

const MAX_BIO_LENGTH = 120;

const sanitiseAvatarUrl = (value?: string | null) => {
  const source = value && value.trim() ? value : FALLBACK_AVATAR;
  return source.replace(/["'()]/g, '');
};

const getVisiblePlatforms = (
  links: SocialLinks | undefined,
  selected: SocialPlatformId[] | undefined,
): Array<{ id: SocialPlatformId; url: string }> => {
  if (!links) {
    return [];
  }

  // If no platforms are selected, return empty array (show no social links)
  if (!selected || selected.length === 0) {
    return [];
  }

  const results: Array<{ id: SocialPlatformId; url: string }> = [];

  const instagramUrl = ensureSocialUrl('instagram', links.instagram);
  if (instagramUrl && selected.includes('instagram')) {
    results.push({ id: 'instagram', url: instagramUrl });
  }

  const linkedinUrl = ensureSocialUrl('linkedin', links.linkedin);
  if (linkedinUrl && selected.includes('linkedin')) {
    results.push({ id: 'linkedin', url: linkedinUrl });
  }

  const twitterHandle = getTwitterHandle(links);
  const twitterUrl = ensureSocialUrl('twitter', twitterHandle);
  if (twitterUrl && selected.includes('twitter')) {
    results.push({ id: 'twitter', url: twitterUrl });
  }

  return results;
};

export type SocialProfileCardProps = {
  user: NearbyUserData;
  selectedAccounts?: SocialPlatformId[];
  borderRadius?: number;
};

export const SocialProfileCard: React.FC<SocialProfileCardProps> = ({
  user,
  selectedAccounts,
  borderRadius = 20,
}) => {
  const router = useRouter();

  const displayBio = useMemo(() => {
    const bio = user.bio || '';
    return bio.length > MAX_BIO_LENGTH
      ? `${bio.slice(0, MAX_BIO_LENGTH)}...`
      : bio;
  }, [user.bio]);

  const avatarSource = useMemo(
    () => ({ uri: sanitiseAvatarUrl(user.profilePhoto) }),
    [user.profilePhoto],
  );

  const platforms = useMemo(
    () => getVisiblePlatforms(user.socialLinks, selectedAccounts),
    [selectedAccounts, user.socialLinks],
  );

  const handleProfilePress = () => {
    router.push(`/profile/${user.id}`);
  };

  const handleMessagePress = () => {
    router.push(`/messages/${user.id}`);
  };

  const handleLinkPress = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.warn('Unable to open url', error);
    }
  };

  return (
    <View style={[styles.card, { borderRadius }]}>
      <View style={styles.topRow}>
        <View style={styles.avatarWrapper}>
          <Image source={avatarSource} style={styles.avatar} />
        </View>

        <View style={styles.topContent}>
          <View style={styles.nameWrapper}>
            <Text style={styles.name} numberOfLines={1}>
              {user.name}
            </Text>
            {user.username ? (
              <Text style={styles.username} numberOfLines={1}>
                @{user.username}
              </Text>
            ) : null}
          </View>

          <Text style={styles.bio} numberOfLines={2}>
            {displayBio}
          </Text>
        </View>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.socialRow}>
          {platforms.map(({ id, url }) => {
            const meta = SOCIAL_PLATFORMS[id];
            const icon = meta.renderIcon({ size: 20, color: meta.wantsWhiteIcon ? '#ffffff' : '#000000' });

            return (
              <Pressable
                key={id}
                onPress={() => handleLinkPress(url)}
                style={({ pressed }) => [styles.socialButton, pressed ? styles.socialButtonPressed : null]}
                android_ripple={{ color: 'rgba(255, 255, 255, 0.12)' }}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel={meta.label}
              >
                {id === 'instagram' ? (
                  <LinearGradient
                    colors={INSTAGRAM_GRADIENT}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.socialBadge}
                  >
                    {icon}
                  </LinearGradient>
                ) : (
                  <View
                    style={[
                      styles.socialBadge,
                      meta.style.backgroundColor
                        ? { backgroundColor: meta.style.backgroundColor }
                        : null,
                    ]}
                  >
                    {icon}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={styles.actionButton}
            onPress={handleProfilePress}
            accessibilityRole="button"
            accessibilityLabel="View profile"
          >
            <User size={22} color="#ffffff" strokeWidth={2} />
          </Pressable>
          <Pressable
            style={styles.actionButton}
            onPress={handleMessagePress}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <MessageSquare size={22} color="#ffffff" strokeWidth={2} />
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#000000',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    shadowColor: '#ffffff',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 4, height: 8 },
    elevation: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarWrapper: {
    marginRight: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 4,
    backgroundColor: '#111827',
  },
  topContent: {
    flex: 1,
    minWidth: 0,
  },
  nameWrapper: {
    marginBottom: 4,
  },
  name: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  username: {
    color: '#9ca3af',
    fontSize: 14,
  },
  bio: {
    color: '#f8fafc',
    fontSize: 15,
    lineHeight: 20,
  },
  bottomRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  socialButton: {
    marginRight: 10,
  },
  socialButtonPressed: {
    opacity: 0.7,
  },
  socialBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    marginLeft: 12,
  },
});

export default SocialProfileCard;

import React, { useCallback, useMemo } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import type { FeedPost } from '../constants/feedData';
import {
  DEFAULT_VISIBLE_PLATFORMS,
  SOCIAL_PLATFORMS,
  ensureSocialUrl,
  getTwitterHandle,
  type SocialPlatformId,
} from '../constants/socialPlatforms';

const INSTAGRAM_GRADIENT = [
  '#f09433',
  '#e6683c',
  '#dc2743',
  '#cc2366',
  '#bc1888',
] as const;

export type PostProps = {
  post: FeedPost;
  selectedAccounts?: SocialPlatformId[];
  showSocialLinks?: boolean;
};

export const Post: React.FC<PostProps> = ({
  post,
  selectedAccounts = DEFAULT_VISIBLE_PLATFORMS,
  showSocialLinks = true,
}) => {
  const { author, content, image, timestamp } = post;

  const socialEntries = useMemo(() => {
    if (!author.socialLinks) {
      return [];
    }

    const instagram = ensureSocialUrl('instagram', author.socialLinks.instagram);
    const linkedin = ensureSocialUrl('linkedin', author.socialLinks.linkedin);
    const twitterHandle = getTwitterHandle(author.socialLinks);
    const twitter = ensureSocialUrl('twitter', twitterHandle);

    const entries: Array<{ id: SocialPlatformId; url: string }> = [];

    if (instagram && selectedAccounts.includes('instagram')) {
      entries.push({ id: 'instagram', url: instagram });
    }
    if (linkedin && selectedAccounts.includes('linkedin')) {
      entries.push({ id: 'linkedin', url: linkedin });
    }
    if (twitter && selectedAccounts.includes('twitter')) {
      entries.push({ id: 'twitter', url: twitter });
    }

    return entries;
  }, [author.socialLinks, selectedAccounts]);

  const avatarUri = useMemo(() => {
    if (author.avatar && author.avatar.trim().length) {
      return author.avatar.trim();
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(author.name)}&background=random&color=fff&size=128`;
  }, [author.avatar, author.name]);

  const handleOpenLink = useCallback(async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.warn('Unable to open url', error);
    }
  }, []);

  return (
    <View style={styles.postContainer}>
      <View style={styles.wrapper}>
        {showSocialLinks && socialEntries.length > 0 ? (
          <View style={styles.socialLinksRow}>
            {socialEntries.map(({ id, url }) => {
              const meta = SOCIAL_PLATFORMS[id];
              const icon = meta.renderIcon({ size: 18, color: '#ffffff' });

              return (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityLabel={meta.label}
                  onPress={() => handleOpenLink(url)}
                  style={styles.socialButton}
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
        ) : null}

        <View style={styles.contentRow}>
          <View style={styles.avatarWrapper}>
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          </View>

          <View style={styles.postBody}>
            <View style={styles.authorBlock}>
              <Text style={styles.authorName}>{author.name}</Text>
              <Text style={styles.authorMeta}>
                @{author.username} � {timestamp}
              </Text>
            </View>

            <Text style={styles.postText}>{content}</Text>

            {image ? (
              <View style={styles.postMediaWrapper}>
                <Image source={{ uri: image }} style={styles.postMedia} />
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.dividerWrapper}>
        <View style={styles.divider} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  postContainer: {
    marginBottom: 16,
  },
  wrapper: {
    position: 'relative',
  },
  socialLinksRow: {
    position: 'absolute',
    top: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  socialButton: {
    marginLeft: 12,
  },
  socialBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarWrapper: {
    marginRight: 16,
    paddingTop: 6,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 5,
    backgroundColor: '#111827',
  },
  postBody: {
    flex: 1,
    minWidth: 0,
  },
  authorBlock: {
    marginBottom: 8,
  },
  authorName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  authorMeta: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 2,
  },
  postText: {
    color: '#f1f5f9',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 12,
  },
  postMediaWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.6)',
  },
  postMedia: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  dividerWrapper: {
    marginTop: 12,
    // Extend the separator to full width beyond list padding
    marginLeft: -24,
    marginRight: -24,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(100, 116, 139, 0.6)',
    width: '100%',
  },
});

export default Post;

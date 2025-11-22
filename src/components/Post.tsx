import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import ConfirmDialog from './ConfirmDialog';
import OptionsDialog from './OptionsDialog';
import DropdownMenu from './DropdownMenu';
import { supabase } from '../lib/supabase';

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
  showMenu?: boolean;
  showTimestamp?: boolean;
  onDelete?: (id: string) => void;
};

export const Post: React.FC<PostProps> = ({
  post,
  selectedAccounts = DEFAULT_VISIBLE_PLATFORMS,
  showSocialLinks = true,
  showMenu = false,
  showTimestamp = true,
  onDelete,
}) => {
  const { author, content, image, timestamp } = post;
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);

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

  const handleAuthorPress = useCallback(async () => {
    if (!author.id) {
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.id === author.id) {
        router.push('/profile');
      } else {
        router.push(`/profile/${author.id}`);
      }
    } catch {
      router.push(`/profile/${author.id}`);
    }
  }, [author.id, router]);

  const handleOpenLink = useCallback(async (url: string) => {
    try {
      if (Platform.OS === 'web') {
        // On web, directly open in new tab to avoid canOpenURL limitations
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      console.warn('Unable to open url', error);
    }
  }, []);

  const handleMenuPress = useCallback(() => {
    if (!showMenu) return;
    setDropdownOpen(true);
  }, [showMenu]);

  const handleConfirmDelete = useCallback(() => {
    setConfirmOpen(false);
    onDelete?.(post.id);
  }, [post.id, onDelete]);

  useEffect(() => {
    if (!image) {
      setImageAspectRatio(null);
      return;
    }

    let isMounted = true;

    Image.getSize(
      image,
      (width, height) => {
        if (!isMounted) return;
        if (width > 0 && height > 0) {
          setImageAspectRatio(width / height);
        } else {
          setImageAspectRatio(null);
        }
      },
      () => {
        if (isMounted) {
          setImageAspectRatio(null);
        }
      },
    );

    return () => {
      isMounted = false;
    };
  }, [image]);

  const postMediaStyle = useMemo(() => {
    if (!image) {
      return styles.postMedia;
    }

    if (imageAspectRatio && Number.isFinite(imageAspectRatio) && imageAspectRatio > 0) {
      return [styles.postMedia, { aspectRatio: imageAspectRatio }];
    }

    return styles.postMedia;
  }, [image, imageAspectRatio]);

  return (
    <View style={styles.postContainer}>
      <View style={styles.wrapper}>
        {showMenu ? (
          <Pressable
            onPress={handleMenuPress}
            style={styles.menuButton}
            accessibilityRole="button"
            accessibilityLabel="Post options"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="more-vertical" size={18} color="#94a3b8" />
          </Pressable>
        ) : null}
        {showSocialLinks && socialEntries.length > 0 ? (
          <View style={[styles.socialLinksRow, { right: showMenu ? 44 : 0 }]}>
            {socialEntries.map(({ id, url }) => {
              const meta = SOCIAL_PLATFORMS[id];
              const icon = meta.renderIcon({ size: 18, color: '#ffffff' });

              return (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityLabel={meta.label}
                  onPress={() => handleOpenLink(url)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
          <Pressable
            style={({ pressed }) => [
              styles.avatarWrapper,
              pressed && author.id ? styles.avatarPressed : null,
            ]}
            onPress={handleAuthorPress}
            accessibilityRole={author.id ? 'button' : undefined}
            accessibilityLabel={author.id ? `View ${author.name}'s profile` : undefined}
            disabled={!author.id}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 12 }}
          >
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          </Pressable>

          <View style={styles.postBody}>
            <View style={styles.authorBlock}>
              <Text style={styles.authorName}>{author.name}</Text>
              <Text style={styles.authorMeta}>
                @{author.username}
                {showTimestamp && timestamp ? `  ${timestamp}` : ''}
              </Text>
            </View>

            <Text style={[styles.postText, image ? styles.postTextWithMedia : null]}>
              {content}
            </Text>

            {image ? (
              <View style={styles.postMediaWrapper}>
                <Image
                  source={{ uri: image }}
                  style={postMediaStyle}
                  resizeMode="contain"
                />
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.dividerWrapper}>
        <View style={styles.divider} />
      </View>

      <DropdownMenu
        visible={dropdownOpen}
        onClose={() => setDropdownOpen(false)}
        items={[
          {
            label: 'Delete',
            iconName: 'trash-2',
            destructive: true,
            onPress: () => setConfirmOpen(true),
          },
        ]}
      // Anchored relative positioning handled inside component
      />

      <ConfirmDialog
        visible={confirmOpen}
        message={'Are you sure you want to delete this post?'}
        confirmLabel={'Delete'}
        cancelLabel={'Cancel'}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
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
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    // Ensure clickable on web by stacking above content
    zIndex: 5,
  },
  menuButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    // remove background to match requested style
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  socialButton: {
    marginLeft: 12,
    // Improve web UX: show pointer cursor on hover
    cursor: 'pointer',
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
  avatarPressed: {
    opacity: 0.75,
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
  postTextWithMedia: {
    marginBottom: 14,
  },
  postMediaWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.6)',
    alignSelf: 'stretch',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postMedia: {
    width: '100%',
    aspectRatio: 4 / 3,
    minHeight: 160,
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



import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  ImageSourcePropType,
  Linking,
  Pressable,
  StatusBar,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { MessageSquare } from 'lucide-react-native';

import Post from '../../src/components/Post';
import {
  SOCIAL_PLATFORMS,
  ensureSocialUrl,
  type SocialPlatformId,
} from '../../src/constants/socialPlatforms';
import {
  getProfileById,
  getUserPosts,
  type Profile,
  type SocialLinks,
  type Post as DbPost,
} from '../../src/services';

const FALLBACK_BANNER =
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80';
const FALLBACK_AVATAR =
  'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';

const INSTAGRAM_GRADIENT = [
  '#f09433',
  '#e6683c',
  '#dc2743',
  '#cc2366',
  '#bc1888',
] as const;

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const SOCIAL_ORDER: Array<{ id: SocialPlatformId; key: 'instagram' | 'linkedin' | 'twitter' }> = [
  { id: 'instagram', key: 'instagram' },
  { id: 'linkedin', key: 'linkedin' },
  { id: 'twitter', key: 'twitter' },
];

const resolveImageSource = (uri?: string | null, fallback?: string): ImageSourcePropType => {
  if (uri && uri.trim().length > 0) {
    return { uri };
  }
  if (fallback) {
    return { uri: fallback };
  }
  return { uri: FALLBACK_AVATAR };
};

const UserProfileScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [socialLinks, setSocialLinks] = useState<SocialLinks | null>(null);
  const [posts, setPosts] = useState<DbPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  // Responsive spacing units
  const { width } = useWindowDimensions();
  const headerGap = width < 360 ? 10 : width < 768 ? 12 : 14;
  const bannerMargin = 32 + headerGap; // avatar overhang (92 - 60) + dynamic gap

  const requestedId = useMemo(() => {
    const value = params.id;
    const asString = Array.isArray(value) ? value[0] : value;
    return (asString ?? '').trim();
  }, [params.id]);

  const loadProfile = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!requestedId) {
        if (!options.silent) {
          setLoading(false);
        }
        return;
      }

      if (!options.silent) {
        setLoading(true);
      }
      setError(null);

      try {
        const {
          profile: profileData,
          socialLinks: socialData,
          error: profileError,
        } = await getProfileById(requestedId);

        if (profileError || !profileData) {
          setError('Profile not found');
          setProfile(null);
          setSocialLinks(null);
          setPosts([]);
          return;
        }

        setProfile(profileData);
        setSocialLinks(socialData);

        const { posts: postsData, error: postsError } = await getUserPosts(requestedId);

        if (postsError) {
          setError('Error loading posts');
        } else {
          setPosts(postsData);
        }
      } finally {
        if (!options.silent) {
          setLoading(false);
        }
      }
    },
    [requestedId],
  );

  useEffect(() => {
    let isMounted = true;
    hasLoadedRef.current = false;

    loadProfile().finally(() => {
      if (isMounted) {
        hasLoadedRef.current = true;
      }
    });

    return () => {
      isMounted = false;
    };
  }, [loadProfile]);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedRef.current) {
        return;
      }

      loadProfile({ silent: true });
    }, [loadProfile]),
  );

  const bannerSource = useMemo(
    () => resolveImageSource(socialLinks?.banner_url, FALLBACK_BANNER),
    [socialLinks?.banner_url]
  );

  const avatarSource = useMemo(
    () => resolveImageSource(socialLinks?.profile_pic_url, FALLBACK_AVATAR),
    [socialLinks?.profile_pic_url]
  );

  const socialEntries = useMemo(() => {
    if (!socialLinks) {
      return SOCIAL_ORDER.map(({ id }) => ({ id, url: null, disabled: true }));
    }

    return SOCIAL_ORDER.map(({ id, key }) => {
      const handle = key === 'twitter' ? socialLinks.x_twitter : socialLinks[key];
      const url = ensureSocialUrl(id, handle);
      return {
        id,
        url,
        disabled: !url,
      };
    });
  }, [socialLinks]);

  const renderPost = useCallback(
    ({ item }: { item: DbPost }) => {
      if (!profile || !socialLinks) return null;

      const feedPost = {
        id: item.id,
        author: {
          name: profile.display_name,
          username: profile.user_name,
          avatar: socialLinks.profile_pic_url || undefined,
          socialLinks: {
            instagram: socialLinks.instagram,
            linkedin: socialLinks.linkedin,
            twitter: socialLinks.x_twitter,
          },
        },
        content: item.content,
        image: item.image_url ?? undefined,
        timestamp: formatDate(item.created_at),
      };

      return <Post post={feedPost} showSocialLinks={false} />;
    },
    [profile, socialLinks],
  );

  // Navigation is now rendered in the root layout

  if (loading) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <Text style={{ color: '#94a3b8', fontSize: 16 }}>Loading profile...</Text>
        {/* Navigation is now rendered in the root layout */}
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <Text style={{ color: '#ef4444', fontSize: 16 }}>{error || 'Profile not found'}</Text>
        {/* Navigation is now rendered in the root layout */}
      </View>
    );
  }

  const handleMessagePress = () => {
    if (!requestedId) return;
    router.push(`/messages/${requestedId}`);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        ListHeaderComponent={
          <View style={[styles.listHeader, { gap: headerGap, paddingTop: headerGap }]}> 
            <View style={[styles.bannerWrapper, { marginBottom: bannerMargin }]}>
              <Image source={bannerSource} style={styles.bannerImage} />
              <View style={styles.bannerGradient} pointerEvents="none" />
              {/* Overlaid back + message buttons */}
              <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => [styles.backButton, pressed ? { opacity: 0.9 } : null]}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <View style={styles.backCircle}>
                  <Feather name="arrow-left" size={22} color="#ffffff" />
                </View>
              </Pressable>

              <Pressable
                onPress={handleMessagePress}
                style={({ pressed }) => [styles.messageButton, pressed ? { opacity: 0.9 } : null]}
                accessibilityRole="button"
                accessibilityLabel="Message user"
              >
                <View style={styles.backCircle}>
                  <MessageSquare size={22} color="#ffffff" strokeWidth={2} />
                </View>
              </Pressable>

              <View style={styles.bannerOverlayRow}>
                <View style={styles.avatarWrapper}>
                  <Image source={avatarSource} style={styles.avatar} />
                </View>
                <View style={styles.socialCluster}>
                  {socialEntries.map(({ id, url, disabled }) => {
                    const meta = SOCIAL_PLATFORMS[id];

                    if (id === 'instagram') {
                      return (
                        <Pressable
                          key={id}
                          onPress={() => {
                            if (disabled || !url) return;
                          const finalUrl = ensureSocialUrl(id as SocialPlatformId, url);
                          if (!finalUrl) return;
                          Linking.openURL(finalUrl).catch(() => {
                            // no-op; in development builds some schemes may fail
                          });
                          }}
                          disabled={disabled}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: true }}
                          style={({ pressed }) => [
                            styles.socialButton,
                            pressed ? styles.socialButtonPressed : null,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={meta.label}
                        >
                          <LinearGradient
                            colors={INSTAGRAM_GRADIENT}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[styles.socialBadge, disabled ? styles.socialDisabled : null]}
                          >
                            {meta.renderIcon({ size: 18, color: '#ffffff' })}
                          </LinearGradient>
                        </Pressable>
                      );
                    }

                    const badgeStyle: StyleProp<ViewStyle> = [
                      styles.socialBadge,
                      id === 'twitter' ? styles.outlinedBadge : null,
                      id !== 'twitter' && meta.style.backgroundColor
                        ? { backgroundColor: meta.style.backgroundColor }
                        : null,
                      disabled ? styles.socialDisabled : null,
                    ];

                    return (
                      <Pressable
                        key={id}
                        onPress={() => {
                          if (disabled || !url) return;
                          const finalUrl = ensureSocialUrl(id as SocialPlatformId, url);
                          if (!finalUrl) return;
                          Linking.openURL(finalUrl).catch(() => {
                            // no-op; in development builds some schemes may fail
                          });
                        }}
                        disabled={disabled}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: true }}
                        style={({ pressed }) => [
                          styles.socialButton,
                          pressed ? styles.socialButtonPressed : null,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={meta.label}
                      >
                        <View style={badgeStyle}>
                          {meta.renderIcon({ size: 18, color: '#ffffff' })}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={styles.identityBlock}>
              <Text style={styles.name}>{profile.display_name}</Text>
              <Text style={styles.handle}>@{profile.user_name}</Text>
            </View>

            <Text style={styles.bio}>{socialLinks?.bio || 'No bio yet'}</Text>

            <View style={{ marginLeft: -24, marginRight: -24, marginTop: 8 }}>
              <View style={styles.divider} />
            </View>

            <Text style={styles.sectionTitle}>Posts</Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.emptyState}>No posts yet</Text>}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
      {/* Navigation is now rendered in the root layout */}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  listContent: {
    // Match feed list padding for consistent post indentation
    paddingHorizontal: 24,
    paddingBottom: 140,
    gap: 16,
  },
  listHeader: {
    gap: 12,
    // Slightly reduce top padding now that the header title is removed
    paddingTop: 12,
  },
  bannerWrapper: {
    position: 'relative',
    backgroundColor: '#111827',
    // Align banner to edges relative to list padding
    marginHorizontal: -24,
    marginBottom: 56,
  },
  bannerImage: {
    width: '100%',
    height: 212,
  },
  bannerGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
  },
  messageButton: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  backCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerOverlayRow: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: -60,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    zIndex: 10,
    elevation: 10,
  },
  avatarWrapper: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#000000',
    backgroundColor: '#000000',
    padding: 2,
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 6,
    backgroundColor: '#0f172a',
  },
  socialCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    // Move social icons up by 5px (remove previous downward offset)
    transform: [{ translateX: 5 }, { translateY: 0 }],
  },
  socialButton: {
    borderRadius: 8,
  },
  socialButtonPressed: {
    opacity: 0.9,
  },
  socialBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.82)',
  },
  outlinedBadge: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.45)',
  },
  socialDisabled: {
    opacity: 0.35,
  },
  identityBlock: {
    // Move name and username up by 10px
    marginTop: 0,
  },
  name: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
  },
  handle: {
    marginTop: 4,
    color: '#94a3b8',
    fontSize: 15,
  },
  bio: {
    marginTop: 4,
    color: '#e2e8f0',
    fontSize: 15,
    lineHeight: 22,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(71, 85, 105, 0.6)',
    marginTop: 8,
    // Make header divider full-bleed like feed separators
    marginLeft: -24,
    marginRight: -24,
    width: '100%',
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 0,
  },
  emptyState: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 24,
  },
});

export default UserProfileScreen;

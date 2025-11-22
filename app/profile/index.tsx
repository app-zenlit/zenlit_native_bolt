import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { useFocusEffect, useRouter } from 'expo-router';

import AppHeader from '../../src/components/AppHeader';
import LogoutConfirmation from '../../src/components/LogoutConfirmation';
import ProfileMenuSheet from '../../src/components/profile/ProfileMenuSheet';
import Post from '../../src/components/Post';
import {
  SOCIAL_PLATFORMS,
  ensureSocialUrl,
  getTwitterHandle,
} from '../../src/constants/socialPlatforms';
import { getUserPosts, deletePost as deletePostDb, Post as PostType } from '../../src/services';
import { useProfile } from '../../src/contexts/ProfileContext';
import { supabase } from '../../src/lib/supabase';
import { getPostLogoutRoute } from '../../src/utils/authNavigation';

const SOCIAL_ORDER: Array<'instagram' | 'linkedin' | 'twitter'> = [
  'instagram',
  'linkedin',
  'twitter',
];

const FALLBACK_BANNER_URI =
  'https://images.unsplash.com/photo-1519669556878-619358287bf8?auto=format&fit=crop&w=1200&q=80';

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

const ProfileScreen: React.FC = () => {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const { profile, socialLinks, isRefreshing, error, refresh } = useProfile();
  const [posts, setPosts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const { width } = useWindowDimensions();
  const headerGap = width < 360 ? 10 : width < 768 ? 12 : 14;
  const bannerMargin = 32 + headerGap; // avatar overhang (92 - 60) + dynamic gap

  useFocusEffect(
    useCallback(() => {
      refresh(false);
      return undefined;
    }, [refresh])
  );

  useEffect(() => {
    if (!profile?.id) {
      setLoading(isRefreshing);
      return;
    }
    (async () => {
      setLoading(true);
      const { posts: userPosts } = await getUserPosts(profile.id);
      setPosts(userPosts);
      setLoading(false);
    })();
  }, [profile?.id]);

  const socialEntries = useMemo(() => {
    if (!socialLinks) {
      return [];
    }
    return SOCIAL_ORDER.map((id) => {
      if (id === 'instagram') {
        const url = ensureSocialUrl('instagram', socialLinks.instagram);
        return { id, url: url ?? null } as const;
      }
      if (id === 'linkedin') {
        const url = ensureSocialUrl('linkedin', socialLinks.linkedin);
        return { id, url: url ?? null } as const;
      }
      const handle = getTwitterHandle({ twitter: socialLinks.x_twitter });
      const url = ensureSocialUrl('twitter', handle);
      return { id, url: url ?? null } as const;
    });
  }, [socialLinks]);

  const bannerSource: ImageSourcePropType = socialLinks?.banner_url
    ? { uri: socialLinks.banner_url }
    : { uri: FALLBACK_BANNER_URI };

  const avatarUri = socialLinks?.profile_pic_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.display_name || 'User')}&background=random&color=fff&size=128`;

  const handleCloseMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const handleEditProfile = useCallback(() => {
    setMenuOpen(false);
    router.push('/edit-profile');
  }, [router]);

  const handleFeedback = useCallback(() => {
    setMenuOpen(false);
    router.push('/feedback');
  }, [router]);

  const handleLogout = useCallback(() => {
    setMenuOpen(false);
    setLogoutOpen(true);
  }, []);

  const handleCancelLogout = useCallback(() => {
    setLogoutOpen(false);
  }, []);

  const handleConfirmLogout = useCallback(async () => {
    setLogoutOpen(false);
    const { data } = await supabase.auth.getSession();
    if (data?.session) {
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch {}
    }
    router.replace(getPostLogoutRoute());
  }, [router]);

  const handleDeletePost = useCallback(async (id: string) => {
    const { success } = await deletePostDb(id);
    if (success) {
      setPosts((prev) => prev.filter((p) => p.id !== id));
    }
  }, []);

  const renderPost = useCallback(
    ({ item }: { item: PostType }) => {
      if (!profile) return null;

      const feedPost = {
        id: item.id,
        author: {
          name: profile.display_name,
          username: profile.user_name,
          avatar: avatarUri,
          socialLinks: {
            instagram: socialLinks?.instagram,
            twitter: socialLinks?.x_twitter,
            linkedin: socialLinks?.linkedin,
          },
        },
        content: item.content,
        image: item.image_url ?? undefined,
        timestamp: formatDate(item.created_at),
      };

      return (
        <Post
          post={feedPost}
          showSocialLinks={false}
          showMenu
          showTimestamp
          onDelete={handleDeletePost}
        />
      );
    },
    [handleDeletePost, profile, avatarUri, socialLinks],
  );

  if (loading || (isRefreshing && !profile)) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <AppHeader title="Profile" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#60a5fa" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
        {/* Navigation is now rendered in the root layout */}
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <AppHeader title="Profile" />
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error || 'Failed to load profile'}</Text>
        </View>
        {/* Navigation is now rendered in the root layout */}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <AppHeader title="Profile" onMenuPress={() => setMenuOpen(true)} />
      <ProfileMenuSheet
        visible={menuOpen}
        onRequestClose={handleCloseMenu}
        onEditProfile={handleEditProfile}
        onFeedback={handleFeedback}
        onLogout={handleLogout}
      />
      <LogoutConfirmation
        visible={logoutOpen}
        onCancel={handleCancelLogout}
        onConfirm={handleConfirmLogout}
      />
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={[styles.listHeader, { gap: headerGap, paddingTop: headerGap }]}>
            <View style={[styles.bannerWrapper, { marginBottom: bannerMargin }]}>
              <Image source={bannerSource} style={styles.bannerImage} resizeMode="cover" />
              <View style={styles.bannerGradient} pointerEvents="none" />
              <View style={styles.bannerOverlayRow}>
                <View style={styles.avatarWrapper}>
                  <Image source={{ uri: avatarUri }} style={styles.avatar} />
                </View>
                <View style={styles.socialCluster}>
                  {socialEntries.map(({ id, url }) => {
                    const meta = SOCIAL_PLATFORMS[id];
                    const disabled = !url;

                    if (id === 'instagram') {
                      return (
                        <Pressable
                          key={id}
                          style={({ pressed }) => [styles.socialButton, pressed ? styles.socialButtonPressed : null]}
                          accessibilityRole="button"
                          accessibilityLabel={meta.label}
                          onPress={() => {
                            if (url) {
                              Linking.openURL(url);
                            } else {
                              router.push('/edit-profile');
                            }
                          }}
                          android_ripple={{ color: 'rgba(255, 255, 255, 0.12)' }}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          disabled={false}
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
                        style={({ pressed }) => [styles.socialButton, pressed ? styles.socialButtonPressed : null]}
                        accessibilityRole="button"
                        accessibilityLabel={meta.label}
                        onPress={() => {
                          if (url) {
                            Linking.openURL(url);
                          } else {
                            router.push('/edit-profile');
                          }
                        }}
                        android_ripple={{ color: 'rgba(255, 255, 255, 0.12)' }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        disabled={false}
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
              <Text style={styles.username}>@{profile.user_name}</Text>
            </View>

            {socialLinks?.bio ? (
              <View style={styles.bioBlock}>
                <Text style={styles.bioText}>{socialLinks.bio}</Text>
              </View>
            ) : null}

            <View style={styles.separatorWrapper}>
              <View style={styles.separator} />
            </View>
            <Text style={styles.sectionTitle}>Posts</Text>
          </View>
        }
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 16,
    marginTop: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 140,
    gap: 16,
  },
  listHeader: {
    gap: 12,
    paddingTop: 12,
  },
  bannerWrapper: {
    position: 'relative',
    backgroundColor: '#111827',
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
  bannerOverlayRow: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: -60,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    zIndex: 2,
    elevation: 2,
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
    transform: [{ translateX: 5 }, { translateY: 0 }],
  },
  socialButton: {
    borderRadius: 8,
  },
  socialButtonPressed: {
    opacity: 0.7,
  },
  socialDisabled: {
    opacity: 0.35,
  },
  socialBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  outlinedBadge: {
    backgroundColor: '#000000',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  identityBlock: {
    marginBottom: 0,
    marginTop: 0,
  },
  name: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
  },
  username: {
    marginTop: 4,
    color: '#94a3b8',
    fontSize: 15,
  },
  bioBlock: {
    marginBottom: 0,
  },
  bioText: {
    color: '#e2e8f0',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
  },
  separatorWrapper: {
    marginTop: 8,
    marginBottom: 8,
    marginLeft: -24,
    marginRight: -24,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(71, 85, 105, 0.6)',
    width: '100%',
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 0,
  },
});

export default ProfileScreen;

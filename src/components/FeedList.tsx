import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { useVisibility } from '../contexts/VisibilityContext';
import { getFeedPosts, PostWithAuthor } from '../services';
import Post from './Post';
import { AnimatedStatusView } from './AnimatedStatusView';

type FeedListProps = {
  refreshSignal?: number;
};

export const FeedList: React.FC<FeedListProps> = ({ refreshSignal }) => {
  const { selectedAccounts, isVisible, locationPermissionDenied, locationStatus } = useVisibility();
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!isVisible || locationPermissionDenied) {
      setPosts([]);
      setLoading(false);
      return;
    }

    if (locationStatus === 'fetching' || locationStatus === 'not-attempted') {
      setLoading(true);
      return;
    }

    if (locationStatus === 'timeout' || locationStatus === 'position-unavailable') {
      setPosts([]);
      setLoading(false);
      return;
    }

    const { posts: fetchedPosts, error: fetchError } = await getFeedPosts();

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setPosts(fetchedPosts);
    }

    setLoading(false);
  }, [isVisible, locationPermissionDenied, locationStatus]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts, refreshSignal]);

  const convertPostToFeedFormat = (post: PostWithAuthor) => {
    const author = post.author;
    const socialLinks = author.social_links;

    return {
      id: post.id,
      author: {
        id: author.id,
        name: author.display_name,
        username: author.user_name,
        avatar: socialLinks?.profile_pic_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(author.display_name)}&background=random&color=fff&size=128`,
        socialLinks: {
          instagram: socialLinks?.instagram || undefined,
          twitter: socialLinks?.x_twitter || undefined,
          linkedin: socialLinks?.linkedin || undefined,
        },
      },
      content: post.content,
      image: post.image_url || undefined,
      timestamp: new Date(post.created_at).toLocaleDateString(),
    };
  };

  if (!isVisible || locationPermissionDenied) {
    return (
      <AnimatedStatusView
        title="Visibility Off"
        subtitle="Enable to see posts"
        icon="eye-off"
      />
    );
  }

  if (loading || locationStatus === 'fetching' || locationStatus === 'not-attempted') {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#60a5fa" />
        <Text style={styles.loadingText}>
          {locationStatus === 'fetching' || locationStatus === 'not-attempted'
            ? 'Getting your location...'
            : 'Loading feed...'}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.errorText}>Error loading feed</Text>
        <Text style={styles.errorDetail}>{error}</Text>
      </View>
    );
  }

  if (locationStatus === 'timeout') {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.emptyText}>Location timeout</Text>
        <Text style={styles.emptySubtext}>
          Couldn't get your location in time. Pull down to try again.
        </Text>
      </View>
    );
  }

  if (locationStatus === 'position-unavailable') {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.emptyText}>Location unavailable</Text>
        <Text style={styles.emptySubtext}>
          Your location couldn't be determined. Check your device settings and pull down to retry.
        </Text>
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <AnimatedStatusView
        title="No posts nearby"
        subtitle="Be the first to post"
        icon="file-text"
      />
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Post post={convertPostToFeedFormat(item)} selectedAccounts={selectedAccounts} showTimestamp={false} />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        onRefresh={loadPosts}
        refreshing={loading}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 8,
    paddingBottom: 160,
    paddingTop: 8,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
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
    marginBottom: 8,
  },
  errorDetail: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default FeedList;

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import AppHeader from '../../src/components/AppHeader';
import ChatList from '../../src/components/messaging/ChatList';
import Navigation from '../../src/components/Navigation';
import { getUserMessageThreads, getConversationPartnerIds, type MessageThread } from '../../src/services';
import { useVisibility } from '../../src/contexts/VisibilityContext';
import { supabase } from '../../src/lib/supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useMessaging } from '../../src/contexts/MessagingContext';

const FALLBACK_AVATAR = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';

const MessagesScreen: React.FC = () => {
  const router = useRouter();
  const { isVisible, locationPermissionDenied } = useVisibility();
  const { threadUnread, refreshUnread } = useMessaging();

  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [conversationPartnerIds, setConversationPartnerIds] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (mounted) setCurrentUserId(data.user?.id ?? null);
    })();
    return () => { mounted = false; };
  }, []);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    try {
      const { threads: threadsData, error } = await getUserMessageThreads();
      if (error) {
        if (error.message !== 'Not authenticated') {
          console.error('Error loading threads:', error);
        }
        setThreads([]);
        setConversationPartnerIds([]);
        return;
      }
      setThreads(threadsData);

      const partnerIds = threadsData.map((thread) => thread.other_user_id);
      setConversationPartnerIds(partnerIds);

      refreshUnread().catch((err) => {
        console.error('Failed to refresh unread counts', err);
      });
    } finally {
      setLoading(false);
    }
  }, [refreshUnread]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads, refreshSignal]);

  useEffect(() => {
    loadThreads();
  }, [isVisible, locationPermissionDenied]);

  useEffect(() => {
    if (!currentUserId) return;

    let loadThreadsTimeout: ReturnType<typeof setTimeout> | null = null;

    const debouncedLoadThreads = () => {
      if (loadThreadsTimeout) {
        clearTimeout(loadThreadsTimeout);
      }
      loadThreadsTimeout = setTimeout(() => {
        loadThreads();
      }, 500);
    };

    const channel = supabase
      .channel('messages-list-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload: RealtimePostgresChangesPayload<any>) => {
          const messageData = payload.new as any;
          if (messageData && (messageData.sender_id === currentUserId || messageData.receiver_id === currentUserId)) {
            debouncedLoadThreads();
          }
        }
      )
      .subscribe();

    return () => {
      if (loadThreadsTimeout) {
        clearTimeout(loadThreadsTimeout);
      }
      supabase.removeChannel(channel);
    };
  }, [currentUserId, loadThreads]);

  useEffect(() => {
    if (!currentUserId || conversationPartnerIds.length === 0) return;

    let loadThreadsTimeout: ReturnType<typeof setTimeout> | null = null;

    const debouncedLoadThreads = () => {
      if (loadThreadsTimeout) {
        clearTimeout(loadThreadsTimeout);
      }
      loadThreadsTimeout = setTimeout(() => {
        loadThreads();
      }, 1000);
    };

    const locationChannel = supabase
      .channel('messages-location-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'locations' },
        (payload: RealtimePostgresChangesPayload<any>) => {
          const locationData = payload.new as any;
          if (locationData && conversationPartnerIds.includes(locationData.id)) {
            debouncedLoadThreads();
          }
        }
      )
      .subscribe();

    return () => {
      if (loadThreadsTimeout) {
        clearTimeout(loadThreadsTimeout);
      }
      supabase.removeChannel(locationChannel);
    };
  }, [currentUserId, conversationPartnerIds, loadThreads]);

  const handleHeaderRefresh = useCallback(() => {
    setRefreshSignal((value) => value + 1);
  }, []);

  const chatThreads = threads.map((thread) => ({
    id: thread.other_user_id,
    peer: {
      id: thread.other_user.id,
      name: thread.other_user.display_name,
      avatar: thread.other_user.social_links?.profile_pic_url || FALLBACK_AVATAR,
    },
    isAnonymous: thread.is_anonymous,
    lastMessageAt: thread.last_message.created_at,
    lastMessageSnippet: thread.last_message.text,
    unreadCount: threadUnread[thread.other_user_id] ?? thread.unread_count ?? 0,
  }));

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <AppHeader title="Messages" onTitlePress={handleHeaderRefresh} />
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#60a5fa" />
        </View>
      ) : threads.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>
            You don't have any conversations yet. Start chatting by discovering people nearby.
          </Text>
        </View>
      ) : (
        <View style={styles.scrollContent}>
          <ChatList
            threads={chatThreads}
            onPressThread={(threadId: string) => router.push(`/messages/${threadId}`)}
          />
        </View>
      )}
      <Navigation />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 180,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
    textAlign: 'center',
  },
});

export default MessagesScreen;

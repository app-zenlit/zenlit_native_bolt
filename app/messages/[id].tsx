import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';

import ChatHeader from '../../src/components/messaging/ChatHeader';
import Composer from '../../src/components/messaging/Composer';
import DayDivider from '../../src/components/messaging/DayDivider';
import MessageBubble, { type MessageStatus } from '../../src/components/messaging/MessageBubble';
import { theme } from '../../src/styles/theme';
import {
  getMessagesBetweenUsers,
  sendMessage,
  type Message,
  getProfileById,
  type Profile,
  type SocialLinks,
  isUserNearby,
} from '../../src/services';
import { supabase } from '../../src/lib/supabase';
import { useMessaging } from '../../src/contexts/MessagingContext';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

const FALLBACK_AVATAR = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';

const formatDayLabel = (isoDate: string): string => {
  const d = new Date(isoDate);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const isServerMessage = (obj: unknown): obj is Message => {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Partial<Message>;
  return (
    typeof o.id === 'string' &&
    typeof o.sender_id === 'string' &&
    typeof o.receiver_id === 'string' &&
    typeof o.created_at === 'string'
  );
};

type ChatMsg = {
  id: string;
  text: string;
  sentAt: string;
  fromMe: boolean;
  status: MessageStatus;
};

type RenderItem =
  | { type: 'day'; id: string; label: string }
  | { type: 'message'; id: string; message: ChatMsg };

const sortMessagesAsc = (list: ChatMsg[]) =>
  [...list].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

const ChatDetailScreen: React.FC = () => {
  const params = useLocalSearchParams<{ id?: string }>();
  const otherUserId = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : undefined;

  const { markThreadDelivered, markThreadRead, setActiveConversation } = useMessaging();
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [socialLinks, setSocialLinks] = useState<SocialLinks | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const mapServerMessage = useCallback(
    (msg: Message): ChatMsg => {
      if (!currentUserId) {
        return {
          id: msg.id,
          text: msg.text || '',
          sentAt: msg.created_at,
          fromMe: false,
          status: 'sent',
        };
      }

      const fromMe = msg.sender_id === currentUserId;
      let status: MessageStatus = 'sent';
      if (fromMe) {
        if (msg.read_at) {
          status = 'read';
        } else if (msg.delivered_at) {
          status = 'delivered';
        } else {
          status = 'sent';
        }
      }

      return {
        id: msg.id,
        text: msg.text || '',
        sentAt: msg.created_at,
        fromMe,
        status,
      };
    },
    [currentUserId]
  );

  useFocusEffect(
    useCallback(() => {
      if (!otherUserId) {
        return () => {};
      }

      setActiveConversation(otherUserId);
      markThreadDelivered(otherUserId).catch((error) => {
        console.error('Failed to mark messages delivered on focus', error);
      });
      markThreadRead(otherUserId).catch((error) => {
        console.error('Failed to mark messages read on focus', error);
      });

      return () => {
        setActiveConversation(null);
      };
    }, [otherUserId, markThreadDelivered, markThreadRead, setActiveConversation])
  );

  useEffect(() => {
    const loadCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    loadCurrentUser();
  }, []);

  const checkAnonymity = useCallback(async () => {
    if (!otherUserId) return;

    const { isNearby } = await isUserNearby(otherUserId);
    setIsAnonymous(!isNearby);
  }, [otherUserId]);

  const listRef = useRef<FlatList<RenderItem>>(null);

  const BATCH_SIZE = 50;
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Track scroll position and content size to keep anchor stable on prepend
  const scrollYRef = useRef(0);
  const contentHeightRef = useRef(0);
  const preAppendHeightRef = useRef(0);
  const preAppendOffsetRef = useRef(0);
  const prependingRef = useRef(false);

  // Initial auto-scroll to end when switching conversations
  useEffect(() => {
    const timeout = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: false });
    }, 0);
    return () => clearTimeout(timeout);
  }, [otherUserId]);


  useEffect(() => {
    if (prependingRef.current) {
      // Skip auto-scroll when older messages are being prepended
      return;
    }
    const timeout = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 60);
    return () => clearTimeout(timeout);
  }, [messages.length]);

  useEffect(() => {
    if (!otherUserId || !currentUserId) {
      return;
    }

    const channel = supabase
      .channel(`chat-user-${otherUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${otherUserId},receiver_id=eq.${currentUserId}`
        },
        (payload: RealtimePostgresChangesPayload<Message>) => {
          const raw = payload.new;
          if (!isServerMessage(raw)) {
            return;
          }
          const newMessage = raw;

          setMessages((prev) => {
            const mapped = mapServerMessage(newMessage);
            const existingIndex = prev.findIndex((m) => m.id === mapped.id);
            if (existingIndex >= 0) {
              const next = [...prev];
              next[existingIndex] = mapped;
              return sortMessagesAsc(next);
            }
            return sortMessagesAsc([...prev, mapped]);
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${currentUserId},receiver_id=eq.${otherUserId}`
        },
        (payload: RealtimePostgresChangesPayload<Message>) => {
          const raw = payload.new;
          if (!isServerMessage(raw)) {
            return;
          }
          const newMessage = raw;

          setMessages((prev) => {
            const mapped = mapServerMessage(newMessage);
            const existingIndex = prev.findIndex((m) => m.id === mapped.id);
            if (existingIndex >= 0) {
              const next = [...prev];
              next[existingIndex] = mapped;
              return sortMessagesAsc(next);
            }
            return sortMessagesAsc([...prev, mapped]);
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload: RealtimePostgresChangesPayload<Message>) => {
          const raw = payload.new;
          if (!isServerMessage(raw)) {
            return;
          }
          const updatedMessage = raw;

          if (
            (updatedMessage.sender_id === currentUserId && updatedMessage.receiver_id === otherUserId) ||
            (updatedMessage.sender_id === otherUserId && updatedMessage.receiver_id === currentUserId)
          ) {
            setMessages((prev) => {
              const index = prev.findIndex((m) => m.id === updatedMessage.id);
              if (index === -1) {
                return prev;
              }
              const next = [...prev];
              next[index] = mapServerMessage(updatedMessage);
              return sortMessagesAsc(next);
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'locations' },
        (payload: RealtimePostgresChangesPayload<any>) => {
          checkAnonymity();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [otherUserId, currentUserId, mapServerMessage, checkAnonymity]);

  // Initial load: latest batch
  useEffect(() => {
    const loadChat = async () => {
      if (!otherUserId || !currentUserId) return;

      setLoading(true);

      const { profile, socialLinks: social, error: profileError } = await getProfileById(otherUserId);

      if (profileError || !profile) {
        console.error('Error loading profile:', profileError);
      } else {
        setOtherUser(profile);
        setSocialLinks(social);
      }

      const { messages: messagesData, error: messagesError } = await getMessagesBetweenUsers(otherUserId, BATCH_SIZE);

      if (messagesError) {
        console.error('Error loading messages:', messagesError);
      } else {
        const chatMessages = sortMessagesAsc(messagesData.map(mapServerMessage));
        setMessages(chatMessages);
        setHasMore(messagesData.length === BATCH_SIZE);
      }

      await checkAnonymity();

      setLoading(false);
    };

    loadChat();
  }, [otherUserId, currentUserId, mapServerMessage, checkAnonymity]);

  const loadOlder = useCallback(async () => {
    if (isFetchingMore || !hasMore || !otherUserId || messages.length === 0) return;

    const oldest = messages[0]?.sentAt;
    if (!oldest) return;

    setIsFetchingMore(true);
    preAppendHeightRef.current = contentHeightRef.current;
    preAppendOffsetRef.current = scrollYRef.current;
    prependingRef.current = true;

    const { messages: olderData, error } = await getMessagesBetweenUsers(otherUserId, BATCH_SIZE, oldest);

    if (error) {
      console.error('Error loading older messages:', error);
    } else if (olderData.length > 0) {
      const olderAsc = sortMessagesAsc(olderData.map(mapServerMessage));
      setMessages((prev) => [...olderAsc, ...prev]);
      setHasMore(olderData.length === BATCH_SIZE);
    } else {
      setHasMore(false);
    }

    setIsFetchingMore(false);
  }, [isFetchingMore, hasMore, otherUserId, messages, mapServerMessage]);

  const data = useMemo<RenderItem[]>(() => {
    const entries: RenderItem[] = [];
    let currentLabel: string | null = null;
    messages.forEach((message) => {
      const label = formatDayLabel(message.sentAt);
      if (label !== currentLabel) {
        currentLabel = label;
        entries.push({ type: 'day', id: `day-${label}-${message.id}`, label });
      }
      entries.push({ type: 'message', id: message.id, message });
    });
    return entries;
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!otherUserId) {
      return;
    }

    const body = text.trim();
    if (!body) {
      return;
    }

    const optimisticId = `local-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const optimisticMessage: ChatMsg = {
      id: optimisticId,
      text: body,
      sentAt: nowIso,
      fromMe: true,
      status: 'pending',
    };

    setMessages((prev) => sortMessagesAsc([...prev, optimisticMessage]));

    try {
      const { message, error } = await sendMessage(otherUserId, body);
      if (error || !message) {
        throw error ?? new Error('Message failed to send');
      }

      setMessages((prev) =>
        sortMessagesAsc(
          prev.map((m) => (m.id === optimisticId ? mapServerMessage(message) : m))
        )
      );
    } catch (err) {
      console.error('Error sending message:', err);
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? { ...m, status: 'failed' } : m))
      );
    }
  };

  const handleRetry = useCallback(
    async (message: ChatMsg) => {
      if (!otherUserId) {
        return;
      }

      const retryTimestamp = new Date().toISOString();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id
            ? { ...m, status: 'pending', sentAt: retryTimestamp }
            : m
        )
      );

      try {
        const { message: sentMessage, error } = await sendMessage(otherUserId, message.text);
        if (error || !sentMessage) {
          throw error ?? new Error('Retry failed');
        }

        setMessages((prev) =>
          sortMessagesAsc(
            prev.map((m) => (m.id === message.id ? mapServerMessage(sentMessage) : m))
          )
        );
      } catch (err) {
        console.error('Error retrying message send:', err);
        setMessages((prev) =>
          prev.map((m) => (m.id === message.id ? { ...m, status: 'failed' } : m))
        );
      }
    },
    [otherUserId, mapServerMessage]
  );

  if (loading) {
    return (
      <View style={styles.missingRoot}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <ChatHeader title="Loading..." />
        </SafeAreaView>
        <View style={styles.missingContent}>
          <Text style={styles.missingText}>Loading conversation...</Text>
        </View>
      </View>
    );
  }

  if (!otherUser) {
    return (
      <View style={styles.missingRoot}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <ChatHeader title="Message" />
        </SafeAreaView>
        <View style={styles.missingContent}>
          <Text style={styles.missingText}>User not found.</Text>
        </View>
      </View>
    );
  }

  const displayName = otherUser.display_name;
  const displayAvatar = isAnonymous ? undefined : (socialLinks?.profile_pic_url || FALLBACK_AVATAR);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ChatHeader
          title={displayName}
          avatarUrl={displayAvatar}
          isAnonymous={isAnonymous}
          profileId={otherUser.id}
        />
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.select({ ios: 'padding', android: 'height' })}
        keyboardVerticalOffset={Platform.select({ ios: 18, android: 0 }) ?? 0}
      >
        <View style={styles.messagesArea}>
          <FlatList
            ref={listRef}
            data={data}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              if (item.type === 'day') {
                return <DayDivider label={item.label} />;
              }
              return (
                <MessageBubble
                  text={item.message.text}
                  createdAt={item.message.sentAt}
                  isMine={item.message.fromMe}
                  status={item.message.status}
                  onRetry={item.message.status === 'failed' ? () => handleRetry(item.message) : undefined}
                />
              );
            }}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onScroll={(e) => {
              const y = e.nativeEvent.contentOffset.y;
              scrollYRef.current = y;
              const TOP_THRESHOLD = 24;
              if (y <= TOP_THRESHOLD) {
                loadOlder();
              }
            }}
            scrollEventThrottle={16}
            onContentSizeChange={(w, h) => {
              if (prependingRef.current) {
                const delta = h - preAppendHeightRef.current;
                if (delta > 0) {
                  listRef.current?.scrollToOffset({ offset: preAppendOffsetRef.current + delta, animated: false });
                }
                prependingRef.current = false;
              }
              contentHeightRef.current = h;
            }}
            ListHeaderComponent={
              isFetchingMore ? (
                <View style={{ paddingVertical: 8, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={theme.colors.muted} />
                </View>
              ) : null
            }
          />
          <SafeAreaView edges={['bottom']} style={styles.composerWrapper}>
            <Composer onSend={handleSend} />
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  missingRoot: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  safeArea: {
    backgroundColor: theme.colors.headerBackground,
  },
  missingContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missingText: {
    color: theme.colors.muted,
    fontSize: 16,
  },
  flex: {
    flex: 1,
  },
  messagesArea: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 72,
    gap: 4,
  },
  composerWrapper: {
    backgroundColor: theme.colors.surface,
  },
});

export default ChatDetailScreen;

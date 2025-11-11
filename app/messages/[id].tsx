import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';

import ChatHeader from '../../src/components/messaging/ChatHeader';
import Composer from '../../src/components/messaging/Composer';
import DayDivider from '../../src/components/messaging/DayDivider';
import MessageBubble, { type MessageStatus } from '../../src/components/messaging/MessageBubble';
import TypingIndicator from '../../src/components/messaging/TypingIndicator';
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
import { createConversationChannel, type BroadcastMessage, type TypingEvent } from '../../src/utils/realtime';
import { setupChatRealtime } from '../../src/utils/chatRealtimeSetup';
import { generateUUID } from '../../src/utils/uuid';

const FALLBACK_AVATAR = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
const BATCH_SIZE = 50;

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

type MessagesState = {
  messages: ChatMsg[];
  hasMore: boolean;
  isFetchingMore: boolean;
};

type MessagesAction =
  | { type: 'SET_MESSAGES'; messages: ChatMsg[]; hasMore: boolean }
  | { type: 'PREPEND_MESSAGES'; messages: ChatMsg[]; hasMore: boolean }
  | { type: 'UPSERT_MESSAGE'; message: ChatMsg }
  | { type: 'UPDATE_MESSAGE'; id: string; updates: Partial<ChatMsg> }
  | { type: 'SET_FETCHING_MORE'; isFetchingMore: boolean };

function messagesReducer(state: MessagesState, action: MessagesAction): MessagesState {
  switch (action.type) {
    case 'SET_MESSAGES':
      return {
        ...state,
        messages: action.messages.sort(
          (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
        ),
        hasMore: action.hasMore,
      };

    case 'PREPEND_MESSAGES': {
      const existingIds = new Set(state.messages.map((m) => m.id));
      const newMessages = action.messages.filter((m) => !existingIds.has(m.id));
      const combined = [...newMessages, ...state.messages];
      return {
        ...state,
        messages: combined.sort(
          (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
        ),
        hasMore: action.hasMore,
      };
    }

    case 'UPSERT_MESSAGE': {
      const existingIndex = state.messages.findIndex((m) => m.id === action.message.id);
      let newMessages: ChatMsg[];

      if (existingIndex >= 0) {
        newMessages = [...state.messages];
        newMessages[existingIndex] = action.message;
      } else {
        newMessages = [...state.messages, action.message];
      }

      return {
        ...state,
        messages: newMessages.sort(
          (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
        ),
      };
    }

    case 'UPDATE_MESSAGE': {
      const index = state.messages.findIndex((m) => m.id === action.id);
      if (index === -1) return state;

      const newMessages = [...state.messages];
      newMessages[index] = { ...newMessages[index], ...action.updates };

      return { ...state, messages: newMessages };
    }

    case 'SET_FETCHING_MORE':
      return { ...state, isFetchingMore: action.isFetchingMore };

    default:
      return state;
  }
}

const sortMessagesAsc = (list: ChatMsg[]) =>
  [...list].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

const ChatDetailScreen: React.FC = () => {
  const params = useLocalSearchParams<{ id?: string }>();
  const otherUserId =
    typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : undefined;

  const { markThreadDelivered, markThreadRead, setActiveConversation } = useMessaging();
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [socialLinks, setSocialLinks] = useState<SocialLinks | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [state, dispatch] = useReducer(messagesReducer, {
    messages: [],
    hasMore: true,
    isFetchingMore: false,
  });

  const listRef = useRef<FlatList<RenderItem>>(null);
  const realtimeManagerRef = useRef<ReturnType<typeof createConversationChannel> | null>(null);
  const eventQueueRef = useRef<Array<() => void>>([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollYRef = useRef(0);
  const contentHeightRef = useRef(0);
  const preAppendHeightRef = useRef(0);
  const preAppendOffsetRef = useRef(0);
  const prependingRef = useRef(false);
  const isAtBottomRef = useRef(true);
  const lastReadMessageIdRef = useRef<string | null>(null);
  const hasMarkedReadRef = useRef(false);

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

      console.log('[RT:Thread] Screen focused');
      setActiveConversation(otherUserId);
      hasMarkedReadRef.current = false;

      markThreadDelivered(otherUserId).catch((error) => {
        console.error('[RT:Thread] Failed to mark messages delivered on focus', error);
      });

      return () => {
        console.log('[RT:Thread] Screen blurred');
        setActiveConversation(null);
        hasMarkedReadRef.current = false;
      };
    }, [otherUserId, markThreadDelivered, setActiveConversation])
  );

  const checkAnonymity = useCallback(async () => {
    if (!otherUserId) return;

    const { isNearby } = await isUserNearby(otherUserId);
    setIsAnonymous(!isNearby);
  }, [otherUserId]);

  const handleTypingChange = useCallback((isUserTyping: boolean) => {
    if (!currentUserId || !realtimeManagerRef.current) return;

    realtimeManagerRef.current.broadcastTyping(currentUserId, isUserTyping);
  }, [currentUserId]);

  const handleTypingEvent = useCallback((event: TypingEvent) => {
    if (event.userId === otherUserId) {
      setIsTyping(event.isTyping);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      if (event.isTyping) {
        typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
        }, 3000);
      }
    }
  }, [otherUserId]);

  const handlePresenceSync = useCallback((userIds: string[]) => {
    if (otherUserId) {
      setIsOnline(userIds.includes(otherUserId));
    }
  }, [otherUserId]);

  const processBatchedEvents = useCallback(() => {
    if (eventQueueRef.current.length === 0) return;

    console.log(`[RT:Thread] Processing ${eventQueueRef.current.length} batched events`);
    const events = [...eventQueueRef.current];
    eventQueueRef.current = [];

    events.forEach((fn) => fn());
  }, []);

  const queueEvent = useCallback(
    (fn: () => void) => {
      eventQueueRef.current.push(fn);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        processBatchedEvents();
      }, 30) as ReturnType<typeof setTimeout>;
    },
    [processBatchedEvents]
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: false });
    }, 0);
    return () => clearTimeout(timeout);
  }, [otherUserId]);

  useEffect(() => {
    if (prependingRef.current) {
      return;
    }
    if (isAtBottomRef.current && state.messages.length > 0) {
      const timeout = setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [state.messages.length]);

  useEffect(() => {
    if (!otherUserId || !currentUserId) {
      return;
    }

    console.log('[RT:Thread] Setting up realtime subscription');

    const manager = setupChatRealtime({
      currentUserId,
      otherUserId,
      handlers: {
        onMessageInsert: (message) => {
          queueEvent(() => {
            const mapped = mapServerMessage(message);
            dispatch({ type: 'UPSERT_MESSAGE', message: mapped });

            if (message.sender_id === otherUserId && isAtBottomRef.current) {
              console.log('[RT:Thread] New message from other user, marking as read (user at bottom)');
              markThreadRead(otherUserId).catch((err) =>
                console.error('[RT:Thread] Failed to mark read', err)
              );
              lastReadMessageIdRef.current = message.id;
              hasMarkedReadRef.current = true;
            }
          });
        },
        onMessageUpdate: (message) => {
          queueEvent(() => {
            const mapped = mapServerMessage(message);
            dispatch({ type: 'UPSERT_MESSAGE', message: mapped });
          });
        },
        onLocationUpdate: () => {
          queueEvent(() => {
            checkAnonymity();
          });
        },
        onPresenceSync: handlePresenceSync,
        onTypingChange: handleTypingEvent,
        onBroadcastMessage: (message) => {
          console.log('[RT:Thread] Received broadcast message', message);
        },
      },
    });

    realtimeManagerRef.current = manager;

    return () => {
      console.log('[RT:Thread] Cleaning up realtime subscription');
      manager.unsubscribe();
      realtimeManagerRef.current = null;
    };
  }, [otherUserId, currentUserId, mapServerMessage, checkAnonymity, markThreadRead, queueEvent, handlePresenceSync, handleTypingEvent]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && otherUserId && currentUserId) {
        console.log('[RT:Thread] App became active, resubscribing');
        if (realtimeManagerRef.current && !realtimeManagerRef.current.isActive()) {
          realtimeManagerRef.current.unsubscribe();

          const manager = createConversationChannel(otherUserId);
          manager.subscribeToConversation(
            { currentUserId, otherUserId },
            {
              onInsert: (payload: RealtimePostgresChangesPayload<any>) => {
                const raw = payload.new;
                if (!isServerMessage(raw)) return;

                queueEvent(() => {
                  const mapped = mapServerMessage(raw);
                  dispatch({ type: 'UPSERT_MESSAGE', message: mapped });
                });
              },
              onUpdate: (payload: RealtimePostgresChangesPayload<any>) => {
                const raw = payload.new;
                if (!isServerMessage(raw)) return;

                console.log('[RT:Thread] Message status updated');
                queueEvent(() => {
                  const mapped = mapServerMessage(raw);
                  dispatch({ type: 'UPSERT_MESSAGE', message: mapped });
                });
              },
            }
          );

          manager.subscribeToLocationUpdates({ currentUserId, otherUserId }, () => {
            queueEvent(() => {
              checkAnonymity();
            });
          });

          realtimeManagerRef.current = manager;
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [otherUserId, currentUserId, mapServerMessage, checkAnonymity, queueEvent]);

  useEffect(() => {
    const loadChat = async () => {
      if (!otherUserId) return;

      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }

      const { profile, socialLinks: social, error: profileError } = await getProfileById(
        otherUserId
      );

      if (profileError || !profile) {
        console.error('[RT:Thread] Error loading profile:', profileError);
      } else {
        setOtherUser(profile);
        setSocialLinks(social);
      }

      if (user) {
        const { messages: messagesData, error: messagesError } = await getMessagesBetweenUsers(
          otherUserId,
          BATCH_SIZE
        );

        if (messagesError) {
          console.error('[RT:Thread] Error loading messages:', messagesError);
        } else {
          const chatMessages = sortMessagesAsc(messagesData.map(mapServerMessage));
          dispatch({
            type: 'SET_MESSAGES',
            messages: chatMessages,
            hasMore: messagesData.length === BATCH_SIZE,
          });
        }
      }

      await checkAnonymity();

      setLoading(false);
    };

    loadChat();
  }, [otherUserId, mapServerMessage, checkAnonymity]);

  const loadOlder = useCallback(async () => {
    if (state.isFetchingMore || !state.hasMore || !otherUserId || state.messages.length === 0)
      return;

    const oldest = state.messages[0]?.sentAt;
    if (!oldest) return;

    console.log('[RT:Thread] Loading older messages');
    dispatch({ type: 'SET_FETCHING_MORE', isFetchingMore: true });
    preAppendHeightRef.current = contentHeightRef.current;
    preAppendOffsetRef.current = scrollYRef.current;
    prependingRef.current = true;

    const { messages: olderData, error } = await getMessagesBetweenUsers(
      otherUserId,
      BATCH_SIZE,
      oldest
    );

    if (error) {
      console.error('[RT:Thread] Error loading older messages:', error);
    } else if (olderData.length > 0) {
      const olderAsc = sortMessagesAsc(olderData.map(mapServerMessage));
      dispatch({
        type: 'PREPEND_MESSAGES',
        messages: olderAsc,
        hasMore: olderData.length === BATCH_SIZE,
      });
    } else {
      dispatch({ type: 'SET_FETCHING_MORE', isFetchingMore: false });
      prependingRef.current = false;
    }

    dispatch({ type: 'SET_FETCHING_MORE', isFetchingMore: false });
  }, [state.isFetchingMore, state.hasMore, state.messages, otherUserId, mapServerMessage]);

  const data = useMemo<RenderItem[]>(() => {
    const entries: RenderItem[] = [];
    let currentLabel: string | null = null;
    state.messages.forEach((message) => {
      const label = formatDayLabel(message.sentAt);
      if (label !== currentLabel) {
        currentLabel = label;
        entries.push({ type: 'day', id: `day-${label}-${message.id}`, label });
      }
      entries.push({ type: 'message', id: message.id, message });
    });
    return entries;
  }, [state.messages]);

  const handleSend = async (text: string) => {
    if (!otherUserId) {
      return;
    }

    const body = text.trim();
    if (!body) {
      return;
    }

    const messageId = generateUUID();
    const nowIso = new Date().toISOString();
    const optimisticMessage: ChatMsg = {
      id: messageId,
      text: body,
      sentAt: nowIso,
      fromMe: true,
      status: 'pending',
    };

    dispatch({ type: 'UPSERT_MESSAGE', message: optimisticMessage });

    try {
      const { message, error } = await sendMessage(otherUserId, body, messageId);
      if (error || !message) {
        throw error ?? new Error('Message failed to send');
      }

      dispatch({
        type: 'UPSERT_MESSAGE',
        message: mapServerMessage(message),
      });
    } catch (err) {
      console.error('[RT:Thread] Error sending message:', err);
      dispatch({
        type: 'UPDATE_MESSAGE',
        id: messageId,
        updates: { status: 'failed' },
      });
    }
  };

  const handleRetry = useCallback(
    async (message: ChatMsg) => {
      if (!otherUserId) {
        return;
      }

      const retryTimestamp = new Date().toISOString();
      dispatch({
        type: 'UPDATE_MESSAGE',
        id: message.id,
        updates: { status: 'pending', sentAt: retryTimestamp },
      });

      try {
        const retryId = generateUUID();
        const { message: sentMessage, error } = await sendMessage(otherUserId, message.text, retryId);
        if (error || !sentMessage) {
          throw error ?? new Error('Retry failed');
        }

        dispatch({
          type: 'UPSERT_MESSAGE',
          message: mapServerMessage(sentMessage),
        });
      } catch (err) {
        console.error('[RT:Thread] Error retrying message send:', err);
        dispatch({
          type: 'UPDATE_MESSAGE',
          id: message.id,
          updates: { status: 'failed' },
        });
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

  const displayName = isAnonymous ? 'Anonymous' : otherUser.display_name;
  const displayAvatar = isAnonymous
    ? undefined
    : socialLinks?.profile_pic_url || FALLBACK_AVATAR;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ChatHeader
          title={displayName}
          avatarUrl={displayAvatar}
          isAnonymous={isAnonymous}
          profileId={otherUser.id}
          isOnline={isOnline}
          isTyping={isTyping}
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
                  onRetry={
                    item.message.status === 'failed' ? () => handleRetry(item.message) : undefined
                  }
                />
              );
            }}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onScroll={(e) => {
              const y = e.nativeEvent.contentOffset.y;
              const height = e.nativeEvent.layoutMeasurement.height;
              const contentHeight = e.nativeEvent.contentSize.height;

              scrollYRef.current = y;
              const wasAtBottom = isAtBottomRef.current;
              isAtBottomRef.current = y + height >= contentHeight - 20;

              if (!wasAtBottom && isAtBottomRef.current && !hasMarkedReadRef.current && otherUserId) {
                console.log('[RT:Thread] User scrolled to bottom, marking messages as read');
                markThreadRead(otherUserId).catch((err) =>
                  console.error('[RT:Thread] Failed to mark read on scroll', err)
                );
                hasMarkedReadRef.current = true;
              }

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
                  listRef.current?.scrollToOffset({
                    offset: preAppendOffsetRef.current + delta,
                    animated: false,
                  });
                }
                prependingRef.current = false;
              }
              contentHeightRef.current = h;
            }}
            ListHeaderComponent={
              state.isFetchingMore ? (
                <View style={{ paddingVertical: 8, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={theme.colors.muted} />
                </View>
              ) : null
            }
            ListFooterComponent={
              isTyping && !isAnonymous && otherUser ? (
                <TypingIndicator displayName={displayName} />
              ) : null
            }
          />
          <SafeAreaView edges={['bottom']} style={styles.composerWrapper}>
            <Composer onSend={handleSend} disabled={isAnonymous} onTypingChange={handleTypingChange} />
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

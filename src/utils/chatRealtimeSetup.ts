import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { createConversationChannel, type BroadcastMessage, type TypingEvent } from './realtime';
import { logger } from './logger';
import type { Message } from '../lib/types';

export type ChatRealtimeHandlers = {
  onMessageInsert: (message: Message) => void;
  onMessageUpdate: (message: Message) => void;
  onLocationUpdate: () => void;
  onPresenceSync: (userIds: string[]) => void;
  onTypingChange: (event: TypingEvent) => void;
  onBroadcastMessage: (message: BroadcastMessage) => void;
};

export type ChatRealtimeConfig = {
  currentUserId: string;
  otherUserId: string;
  handlers: ChatRealtimeHandlers;
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

export function setupChatRealtime(config: ChatRealtimeConfig) {
  const { currentUserId, otherUserId, handlers } = config;

  const manager = createConversationChannel(otherUserId, {
    onStatusChange: (status) => {
      logger.info('RT:Thread', `Channel status changed: ${status}`);
    },
  });

  manager.subscribeToConversation(
    { currentUserId, otherUserId },
    {
      onInsert: (payload: RealtimePostgresChangesPayload<any>) => {
        const raw = payload.new;
        if (!isServerMessage(raw)) return;
        handlers.onMessageInsert(raw);
      },
      onUpdate: (payload: RealtimePostgresChangesPayload<any>) => {
        const raw = payload.new;
        if (!isServerMessage(raw)) return;
        handlers.onMessageUpdate(raw);
      },
      onPresenceSync: (userIds: string[]) => {
        handlers.onPresenceSync(userIds);
      },
      onTypingChange: (event: TypingEvent) => {
        handlers.onTypingChange(event);
      },
      onBroadcastMessage: (message: BroadcastMessage) => {
        handlers.onBroadcastMessage(message);
      },
    }
  );

  manager.subscribeToLocationUpdates({ currentUserId, otherUserId }, () => {
    handlers.onLocationUpdate();
  });

  return manager;
}

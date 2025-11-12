import { supabase } from '../lib/supabase';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type ChannelStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR';

export type RealtimeConfig = {
  channelName: string;
  onStatusChange?: (status: ChannelStatus) => void;
  logTag?: string;
};

export type MessageFilter = {
  currentUserId: string;
  otherUserId: string;
};

export type MessageEventHandler = (payload: RealtimePostgresChangesPayload<any>) => void;

export type PresenceState = {
  userId: string;
  onlineAt: string;
};

export type BroadcastMessage = {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
};

export type TypingEvent = {
  userId: string;
  isTyping: boolean;
};

export class RealtimeManager {
  private channel: RealtimeChannel | null = null;
  private config: RealtimeConfig;
  private isSubscribed = false;
  private retryCount = 0;
  private maxRetries = 4;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private onPresenceSync?: (users: string[]) => void;
  private onTypingChange?: (event: TypingEvent) => void;
  private onBroadcastMessage?: (message: BroadcastMessage) => void;

  constructor(config: RealtimeConfig) {
    this.config = config;
  }

  private log(message: string, ...args: any[]) {
    const tag = this.config.logTag || 'RT:Chat';
    console.log(`[${tag}] ${message}`, ...args);
  }

  private calculateBackoff(): number {
    return Math.min(1000 * Math.pow(2, this.retryCount), 16000);
  }

  async subscribeToConversation(
    filter: MessageFilter,
    handlers: {
      onInsert: MessageEventHandler;
      onUpdate?: MessageEventHandler;
      onPresenceSync?: (users: string[]) => void;
      onTypingChange?: (event: TypingEvent) => void;
      onBroadcastMessage?: (message: BroadcastMessage) => void;
    }
  ): Promise<void> {
    if (this.channel) {
      this.log('Channel already exists, cleaning up before resubscribe');
      this.unsubscribe();
    }

    this.log(`Subscribing to conversation with ${filter.otherUserId} on private channel chat:${filter.currentUserId}`);

    const { currentUserId, otherUserId } = filter;

    this.onPresenceSync = handlers.onPresenceSync;
    this.onTypingChange = handlers.onTypingChange;
    this.onBroadcastMessage = handlers.onBroadcastMessage;

    await supabase.realtime.setAuth();

    this.channel = supabase
      .channel(`chat:${currentUserId}`, {
        config: {
          private: true,
          presence: {
            key: currentUserId,
          },
        },
      })
      .on('broadcast', { event: 'INSERT' }, (payload: { payload?: any }) => {
        this.log('Received broadcast INSERT event', payload);

        const message = payload.payload;
        if (!message) {
          this.log('No payload in broadcast event');
          return;
        }

        if (
          (message.sender_id === otherUserId && message.receiver_id === currentUserId) ||
          (message.sender_id === currentUserId && message.receiver_id === otherUserId)
        ) {
          this.log('Message belongs to active conversation, processing');
          handlers.onInsert({
            eventType: 'INSERT',
            new: message,
            old: {},
            schema: 'public',
            table: 'messages',
            commit_timestamp: new Date().toISOString(),
            errors: [] as string[],
          } as RealtimePostgresChangesPayload<any>);
        } else {
          this.log('Message not for this conversation, ignoring');
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          const msg = payload.new as any;
          if (
            (msg.sender_id === currentUserId && msg.receiver_id === otherUserId) ||
            (msg.sender_id === otherUserId && msg.receiver_id === currentUserId)
          ) {
            this.log('Received UPDATE for conversation message');
            if (handlers.onUpdate) {
              handlers.onUpdate(payload);
            }
          }
        }
      )
      .on('presence', { event: 'sync' }, () => {
        if (!this.channel) return;

        const state = this.channel.presenceState<PresenceState>();
        const userIds = Object.keys(state);
        this.log(`Presence synced: ${userIds.length} users online`);

        if (this.onPresenceSync) {
          this.onPresenceSync(userIds);
        }
      })
      .on('broadcast', { event: 'typing' }, (payload: { payload?: unknown }) => {
        this.log('Received typing event', payload);
        if (this.onTypingChange && payload.payload) {
          this.onTypingChange(payload.payload as TypingEvent);
        }
      })
      .on('broadcast', { event: 'message' }, (payload: { payload?: unknown }) => {
        this.log('Received broadcast message', payload);
        if (this.onBroadcastMessage && payload.payload) {
          this.onBroadcastMessage(payload.payload as BroadcastMessage);
        }
      })
      .subscribe(async (status: string) => {
        this.log(`Channel status: ${status}`);

        if (status === 'SUBSCRIBED') {
          this.isSubscribed = true;
          this.retryCount = 0;

          if (this.channel) {
            await this.channel.track({
              userId: currentUserId,
              onlineAt: new Date().toISOString(),
            });
          }

          if (this.config.onStatusChange) {
            this.config.onStatusChange('SUBSCRIBED');
          }
        } else if (status === 'TIMED_OUT') {
          this.isSubscribed = false;
          if (this.config.onStatusChange) {
            this.config.onStatusChange('TIMED_OUT');
          }
          this.attemptRetry(filter, handlers);
        } else if (status === 'CLOSED') {
          this.isSubscribed = false;
          if (this.config.onStatusChange) {
            this.config.onStatusChange('CLOSED');
          }
        } else if (status === 'CHANNEL_ERROR') {
          this.isSubscribed = false;
          if (this.config.onStatusChange) {
            this.config.onStatusChange('CHANNEL_ERROR');
          }
          this.attemptRetry(filter, handlers);
        }
      });
  }

  subscribeToLocationUpdates(
    filter: MessageFilter,
    handler: MessageEventHandler
  ): void {
    if (!this.channel) {
      this.log('Creating channel for location updates');
      this.channel = supabase.channel(this.config.channelName);
    } else {
      this.log('Adding location updates to existing channel');
    }

    const { currentUserId, otherUserId } = filter;

    this.channel!
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'locations',
          filter: `id=eq.${otherUserId}`,
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          this.log('Location update for other user');
          handler(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'locations',
          filter: `id=eq.${currentUserId}`,
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          this.log('Location update for current user');
          handler(payload);
        }
      );

    if (this.channel && !this.isSubscribed) {
      this.channel.subscribe((status: string) => {
        this.log(`Location channel status: ${status}`);
        if (status === 'SUBSCRIBED') {
          this.isSubscribed = true;
        }
      });
    }
  }

  async broadcastTyping(userId: string, isTyping: boolean): Promise<void> {
    if (!this.channel) return;

    await this.channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId, isTyping } as TypingEvent,
    });
  }

  async broadcastMessage(message: BroadcastMessage): Promise<void> {
    if (!this.channel) return;

    await this.channel.send({
      type: 'broadcast',
      event: 'message',
      payload: message,
    });
  }

  private attemptRetry(
    filter: MessageFilter,
    handlers: {
      onInsert: MessageEventHandler;
      onUpdate?: MessageEventHandler;
      onPresenceSync?: (users: string[]) => void;
      onTypingChange?: (event: TypingEvent) => void;
      onBroadcastMessage?: (message: BroadcastMessage) => void;
    }
  ): void {
    if (this.retryCount >= this.maxRetries) {
      this.log(`Max retries (${this.maxRetries}) reached, giving up`);
      return;
    }

    this.retryCount++;
    const backoff = this.calculateBackoff();
    this.log(`Retry ${this.retryCount}/${this.maxRetries} in ${backoff}ms`);

    this.retryTimeout = setTimeout(() => {
      this.subscribeToConversation(filter, handlers);
    }, backoff);
  }

  async unsubscribe(): Promise<void> {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    const channel = this.channel;
    if (!channel) {
      return;
    }

    this.log('Unsubscribing channel');

    // Early state reset to avoid races where this.channel becomes null
    this.channel = null;
    this.isSubscribed = false;

    try {
      try {
        await channel.untrack();
      } catch (error) {
        this.log('Error untracking presence', error);
      }

      await supabase.removeChannel(channel);
    } catch (error) {
      this.log('Error removing channel', error);
    }
  }

  isActive(): boolean {
    return this.isSubscribed;
  }

  getPresenceState(): Record<string, PresenceState[]> {
    if (!this.channel) return {};
    return this.channel.presenceState<PresenceState>();
  }
}

export function createConversationChannel(
  otherUserId: string,
  config?: Partial<RealtimeConfig>
): RealtimeManager {
  return new RealtimeManager({
    channelName: `chat-${otherUserId}`,
    logTag: 'RT:Thread',
    ...config,
  });
}

export function createMessagesListChannel(
  config?: Partial<RealtimeConfig>
): RealtimeManager {
  return new RealtimeManager({
    channelName: 'messages-list',
    logTag: 'RT:List',
    ...config,
  });
}

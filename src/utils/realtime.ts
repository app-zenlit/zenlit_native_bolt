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

export class RealtimeManager {
  private channel: RealtimeChannel | null = null;
  private config: RealtimeConfig;
  private isSubscribed = false;
  private retryCount = 0;
  private maxRetries = 4;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;

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

  subscribeToConversation(
    filter: MessageFilter,
    handlers: {
      onInsert: MessageEventHandler;
      onUpdate?: MessageEventHandler;
    }
  ): void {
    if (this.channel) {
      this.log('Channel already exists, cleaning up before resubscribe');
      this.unsubscribe();
    }

    this.log(`Subscribing to conversation: ${filter.otherUserId}`);

    const { currentUserId, otherUserId } = filter;

    this.channel = supabase
      .channel(this.config.channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${otherUserId},receiver_id=eq.${currentUserId}`,
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          this.log('Received INSERT from other user');
          handlers.onInsert(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${currentUserId},receiver_id=eq.${otherUserId}`,
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          this.log('Received INSERT from current user');
          handlers.onInsert(payload);
        }
      )
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
      .subscribe((status: string) => {
        this.log(`Channel status: ${status}`);

        if (status === 'SUBSCRIBED') {
          this.isSubscribed = true;
          this.retryCount = 0;
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

  private attemptRetry(
    filter: MessageFilter,
    handlers: {
      onInsert: MessageEventHandler;
      onUpdate?: MessageEventHandler;
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

  unsubscribe(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    if (this.channel) {
      this.log('Unsubscribing channel');
      supabase.removeChannel(this.channel);
      this.channel = null;
      this.isSubscribed = false;
    }
  }

  isActive(): boolean {
    return this.isSubscribed;
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

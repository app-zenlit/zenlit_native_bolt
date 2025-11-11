import { supabase } from '../lib/supabase';
import type { Message, MessageThread, Profile, SocialLinks, UserUnreadCount } from '../lib/types';
import { getNearbyUsers } from './locationDbService';

export async function getConversationPartnerIds(): Promise<{ partnerIds: string[]; error: Error | null }> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return { partnerIds: [], error: null };
    }

    const { data: messagesData, error: messagesError } = await supabase
      .from('messages')
      .select('sender_id, receiver_id')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

    if (messagesError) {
      return { partnerIds: [], error: messagesError };
    }

    if (!messagesData || messagesData.length === 0) {
      return { partnerIds: [], error: null };
    }

    const partnerIdsSet = new Set<string>();
    messagesData.forEach((msg: { sender_id: string; receiver_id: string }) => {
      const otherUserId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      partnerIdsSet.add(otherUserId);
    });

    return { partnerIds: Array.from(partnerIdsSet), error: null };
  } catch (error) {
    return { partnerIds: [], error: error as Error };
  }
}

export async function getUserMessageThreads(): Promise<{ threads: MessageThread[]; error: Error | null }> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return { threads: [], error: null };
    }

    const { data: messagesData, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (messagesError) {
      return { threads: [], error: messagesError };
    }

    if (!messagesData || messagesData.length === 0) {
      return { threads: [], error: null };
    }

    const threadMap = new Map<string, Message[]>();
    messagesData.forEach((msg: Message) => {
      const otherUserId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      if (!threadMap.has(otherUserId)) {
        threadMap.set(otherUserId, []);
      }
      threadMap.get(otherUserId)!.push(msg as Message);
    });

    const { users: nearbyUsers } = await getNearbyUsers();
    const nearbyUserIds = new Set((nearbyUsers || []).map(u => u.id));

    const otherUserIds = Array.from(threadMap.keys());

    if (otherUserIds.length === 0) {
      return { threads: [], error: null };
    }

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', otherUserIds);

    if (profilesError) {
      return { threads: [], error: profilesError };
    }

    const { data: socialLinks } = await supabase
      .from('social_links')
      .select('*')
      .in('id', otherUserIds);

    const profilesArr: Profile[] = (profiles || []) as Profile[];
    const socialArr: SocialLinks[] = (socialLinks || []) as SocialLinks[];

    const profilesMap: Map<string, Profile> = new Map(
      profilesArr.map((p) => [p.id, p])
    );
    const socialLinksMap: Map<string, SocialLinks> = new Map(
      socialArr.map((s) => [s.id, s])
    );

    const { data: unreadData } = await supabase.rpc('get_unread_message_counts');
    const unreadMap = new Map<string, number>();
    if (unreadData) {
      unreadData.forEach((item: { sender_id: string; unread_count: number }) => {
        unreadMap.set(item.sender_id, item.unread_count);
      });
    }

    const threads: MessageThread[] = [];
    threadMap.forEach((messages, otherUserId) => {
      const profile = profilesMap.get(otherUserId);
      if (!profile) return;

      const social = socialLinksMap.get(otherUserId);
      const lastMessage = messages[0];

      const isAnonymous = !nearbyUserIds.has(otherUserId);

      threads.push({
        other_user_id: otherUserId,
        other_user: {
          id: profile.id,
          display_name: profile.display_name,
          user_name: profile.user_name,
          date_of_birth: profile.date_of_birth,
          gender: profile.gender,
          email: profile.email,
          account_created_at: profile.account_created_at,
          social_links: social ? {
            id: social.id,
            profile_pic_url: social.profile_pic_url,
            banner_url: social.banner_url,
            bio: social.bio,
            instagram: social.instagram,
            x_twitter: social.x_twitter,
            linkedin: social.linkedin,
            created_at: social.created_at,
            updated_at: social.updated_at,
          } : undefined,
        },
        last_message: lastMessage,
        unread_count: unreadMap.get(otherUserId) || 0,
        is_anonymous: isAnonymous,
      });
    });

    threads.sort((a, b) =>
      new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime()
    );

    return { threads, error: null };
  } catch (error) {
    return { threads: [], error: error as Error };
  }
}

export async function getMessagesBetweenUsers(
  otherUserId: string,
  limit = 100,
  before?: string
): Promise<{ messages: Message[]; error: Error | null }> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return { messages: [], error: new Error('Not authenticated') };
    }

    let query = supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
      );

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { messages: [], error };
    }

    return { messages: (data || []) as Message[], error: null };
  } catch (error) {
    return { messages: [], error: error as Error };
  }
}

export async function sendMessage(
  receiverId: string,
  text: string,
  messageId?: string
): Promise<{ message: Message | null; error: Error | null }> {
  try {
    if (!text || text.trim().length === 0) {
      return { message: null, error: new Error('Message must have text') };
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return { message: null, error: new Error('Not authenticated') };
    }

    const insertData: any = {
      sender_id: user.id,
      receiver_id: receiverId,
      text,
    };

    if (messageId) {
      insertData.id = messageId;
    }

    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert(insertData)
      .select()
      .single();

    if (messageError) {
      return { message: null, error: messageError };
    }

    return { message: message as Message, error: null };
  } catch (error) {
    return { message: null, error: error as Error };
  }
}

export async function markMessagesDelivered(
  otherUserId: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.rpc('mark_messages_delivered', {
      other_user_id: otherUserId,
    });

    if (error) {
      return { error };
    }

    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

export async function markMessagesRead(
  otherUserId: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.rpc('mark_messages_read', {
      other_user_id: otherUserId,
    });

    if (error) {
      return { error };
    }

    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

export async function getUnreadCounts(): Promise<{ counts: UserUnreadCount[]; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('get_unread_message_counts');

    if (error) {
      return { counts: [], error };
    }

    return { counts: (data || []) as UserUnreadCount[], error: null };
  } catch (error) {
    return { counts: [], error: error as Error };
  }
}

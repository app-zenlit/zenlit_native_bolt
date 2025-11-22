import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

export type NotificationPreferences = {
  messages: boolean;
  proximity: boolean;
  app_updates: boolean;
  system: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  muted_conversations: string[];
};

export function useNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    registerForPushNotificationsAsync();

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      logger.info('Notifications', 'Notification received:', notification);
      setNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      logger.info('Notifications', 'Notification tapped:', response);
      handleNotificationResponse(response);
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  async function registerForPushNotificationsAsync() {
    let token: string | null = null;

    if (Platform.OS === 'web') {
      logger.info('Notifications', 'Push notifications not available on web');
      return;
    }

    if (!Device.isDevice) {
      logger.warn('Notifications', 'Must use physical device for push notifications');
      setPermissionStatus('denied');
      return;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        logger.warn('Notifications', 'Permission not granted');
        setPermissionStatus('denied');
        return;
      }

      setPermissionStatus('granted');

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '0a650645-9cc0-410e-a147-f5409c7c8432',
      });
      token = tokenData.data;

      logger.info('Notifications', 'Got push token:', token);
      setExpoPushToken(token);

      await saveTokenToDatabase(token);

    } catch (error) {
      logger.error('Notifications', 'Error registering for push notifications:', error);
      setPermissionStatus('denied');
    }

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#60a5fa',
      });
    }

    return token;
  }

  async function saveTokenToDatabase(token: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        logger.warn('Notifications', 'No authenticated user to save token');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          expo_push_token: token,
          last_token_update: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        logger.error('Notifications', 'Error saving token to database:', error);
      } else {
        logger.info('Notifications', 'Token saved to database successfully');
      }
    } catch (error) {
      logger.error('Notifications', 'Exception saving token:', error);
    }
  }

  async function unregisterToken() {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({
          expo_push_token: null,
          last_token_update: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        logger.error('Notifications', 'Error removing token from database:', error);
      } else {
        logger.info('Notifications', 'Token removed from database');
        setExpoPushToken(null);
      }
    } catch (error) {
      logger.error('Notifications', 'Exception removing token:', error);
    }
  }

  async function updateNotificationPreferences(preferences: Partial<NotificationPreferences>) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return { error: 'Not authenticated' };

      const { data: profile } = await supabase
        .from('profiles')
        .select('notification_preferences')
        .eq('id', user.id)
        .single();

      const currentPrefs = profile?.notification_preferences || {};
      const updatedPrefs = { ...currentPrefs, ...preferences };

      const { error } = await supabase
        .from('profiles')
        .update({ notification_preferences: updatedPrefs })
        .eq('id', user.id);

      if (error) {
        logger.error('Notifications', 'Error updating preferences:', error);
        return { error: error.message };
      }

      logger.info('Notifications', 'Preferences updated successfully');
      return { error: null };
    } catch (error) {
      logger.error('Notifications', 'Exception updating preferences:', error);
      return { error: 'Failed to update preferences' };
    }
  }

  async function toggleNotifications(enabled: boolean) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return { error: 'Not authenticated' };

      const { error } = await supabase
        .from('profiles')
        .update({ notification_enabled: enabled })
        .eq('id', user.id);

      if (error) {
        logger.error('Notifications', 'Error toggling notifications:', error);
        return { error: error.message };
      }

      logger.info('Notifications', `Notifications ${enabled ? 'enabled' : 'disabled'}`);
      return { error: null };
    } catch (error) {
      logger.error('Notifications', 'Exception toggling notifications:', error);
      return { error: 'Failed to toggle notifications' };
    }
  }

  function handleNotificationResponse(response: Notifications.NotificationResponse) {
    const data = response.notification.request.content.data;

    logger.info('Notifications', 'Handling notification response with data:', data);

    // TODO: Implement navigation based on notification type
    // Example:
    // if (data.type === 'message') {
    //   router.push(`/messages/${data.userId}`);
    // } else if (data.type === 'proximity') {
    //   router.push('/radar');
    // } else if (data.type === 'app_update') {
    //   // Show update modal
    // }
  }

  return {
    expoPushToken,
    notification,
    permissionStatus,
    registerForPushNotifications: registerForPushNotificationsAsync,
    unregisterToken,
    updateNotificationPreferences,
    toggleNotifications,
  };
}

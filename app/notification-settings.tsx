import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { theme } from '../src/styles/theme';
import { supabase } from '../src/lib/supabase';
import { logger } from '../src/utils/logger';
import { useNotifications, type NotificationPreferences } from '../src/hooks/useNotifications';

const NotificationSettingsScreen: React.FC = () => {
  const router = useRouter();
  const { permissionStatus, expoPushToken } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    messages: true,
    proximity: true,
    app_updates: true,
    system: true,
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00',
    muted_conversations: [],
  });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        logger.warn('NotificationSettings', 'No authenticated user');
        setLoading(false);
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('notification_enabled, notification_preferences')
        .eq('id', user.id)
        .single();

      if (error) {
        logger.error('NotificationSettings', 'Error loading settings:', error);
      } else if (profile) {
        setNotificationsEnabled(profile.notification_enabled ?? true);
        if (profile.notification_preferences) {
          setPreferences(prev => ({ ...prev, ...profile.notification_preferences }));
        }
      }

      setLoading(false);
    } catch (error) {
      logger.error('NotificationSettings', 'Exception loading settings:', error);
      setLoading(false);
    }
  }

  async function saveSettings(
    enabled?: boolean,
    prefs?: Partial<NotificationPreferences>
  ) {
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setSaving(false);
        return;
      }

      const updates: any = {};

      if (enabled !== undefined) {
        updates.notification_enabled = enabled;
      }

      if (prefs) {
        const updatedPrefs = { ...preferences, ...prefs };
        updates.notification_preferences = updatedPrefs;
        setPreferences(updatedPrefs);
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        logger.error('NotificationSettings', 'Error saving settings:', error);
      } else {
        logger.info('NotificationSettings', 'Settings saved successfully');
      }

      setSaving(false);
    } catch (error) {
      logger.error('NotificationSettings', 'Exception saving settings:', error);
      setSaving(false);
    }
  }

  function handleToggleNotifications(value: boolean) {
    setNotificationsEnabled(value);
    saveSettings(value);
  }

  function handleTogglePreference(key: keyof NotificationPreferences, value: boolean) {
    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);
    saveSettings(undefined, { [key]: value });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#60a5fa" />
        </View>
      </SafeAreaView>
    );
  }

  const hasPermission = permissionStatus === 'granted';
  const hasToken = !!expoPushToken;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      <ScrollView style={styles.content}>
        {Platform.OS !== 'web' && !hasPermission && (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Permission Required</Text>
            <Text style={styles.warningText}>
              Push notifications are disabled. Please enable them in your device settings to
              receive notifications.
            </Text>
          </View>
        )}

        {Platform.OS !== 'web' && hasPermission && !hasToken && (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Setup Required</Text>
            <Text style={styles.warningText}>
              Notification token not registered. Please restart the app to complete setup.
            </Text>
          </View>
        )}

        {Platform.OS === 'web' && (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Not Available on Web</Text>
            <Text style={styles.warningText}>
              Push notifications are only available on mobile devices. Please use the iOS or
              Android app to receive notifications.
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Master Control</Text>
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Enable Notifications</Text>
              <Text style={styles.settingDescription}>
                Turn all notifications on or off
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: '#334155', true: '#60a5fa' }}
              thumbColor="#ffffff"
              disabled={saving || Platform.OS === 'web'}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Notification Types</Text>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Messages</Text>
              <Text style={styles.settingDescription}>
                New message notifications from other users
              </Text>
            </View>
            <Switch
              value={preferences.messages}
              onValueChange={(value) => handleTogglePreference('messages', value)}
              trackColor={{ false: '#334155', true: '#60a5fa' }}
              thumbColor="#ffffff"
              disabled={saving || !notificationsEnabled || Platform.OS === 'web'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Nearby Users</Text>
              <Text style={styles.settingDescription}>
                Alerts when new users are nearby on Radar
              </Text>
            </View>
            <Switch
              value={preferences.proximity}
              onValueChange={(value) => handleTogglePreference('proximity', value)}
              trackColor={{ false: '#334155', true: '#60a5fa' }}
              thumbColor="#ffffff"
              disabled={saving || !notificationsEnabled || Platform.OS === 'web'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>App Updates</Text>
              <Text style={styles.settingDescription}>
                New version and feature announcements
              </Text>
            </View>
            <Switch
              value={preferences.app_updates}
              onValueChange={(value) => handleTogglePreference('app_updates', value)}
              trackColor={{ false: '#334155', true: '#60a5fa' }}
              thumbColor="#ffffff"
              disabled={saving || !notificationsEnabled || Platform.OS === 'web'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>System Notifications</Text>
              <Text style={styles.settingDescription}>
                Maintenance and important announcements
              </Text>
            </View>
            <Switch
              value={preferences.system}
              onValueChange={(value) => handleTogglePreference('system', value)}
              trackColor={{ false: '#334155', true: '#60a5fa' }}
              thumbColor="#ffffff"
              disabled={saving || !notificationsEnabled || Platform.OS === 'web'}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quiet Hours</Text>
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Enable Quiet Hours</Text>
              <Text style={styles.settingDescription}>
                Silence notifications during specified hours
              </Text>
            </View>
            <Switch
              value={preferences.quiet_hours_enabled}
              onValueChange={(value) => handleTogglePreference('quiet_hours_enabled', value)}
              trackColor={{ false: '#334155', true: '#60a5fa' }}
              thumbColor="#ffffff"
              disabled={saving || !notificationsEnabled || Platform.OS === 'web'}
            />
          </View>

          {preferences.quiet_hours_enabled && (
            <View style={styles.quietHoursInfo}>
              <Text style={styles.quietHoursText}>
                Quiet hours: {preferences.quiet_hours_start} - {preferences.quiet_hours_end}
              </Text>
              <Text style={styles.quietHoursSubtext}>
                You won't receive notifications during this time
              </Text>
            </View>
          )}
        </View>

        {Platform.OS !== 'web' && hasToken && (
          <View style={styles.section}>
            <Text style={styles.tokenLabel}>Device Token</Text>
            <Text style={styles.tokenText} numberOfLines={2}>
              {expoPushToken}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f59e0b',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  quietHoursInfo: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  quietHoursText: {
    fontSize: 15,
    color: '#ffffff',
    marginBottom: 4,
  },
  quietHoursSubtext: {
    fontSize: 13,
    color: '#64748b',
  },
  tokenLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  tokenText: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 8,
  },
});

export default NotificationSettingsScreen;

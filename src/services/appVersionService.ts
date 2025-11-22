import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

export interface AppVersion {
  id: string;
  version: string;
  build_number: number;
  platform: 'ios' | 'android' | 'all';
  is_critical: boolean;
  min_required_version: string | null;
  release_notes: string | null;
  download_url: string | null;
  released_at: string;
}

export async function checkForAppUpdate(): Promise<{
  hasUpdate: boolean;
  isCritical: boolean;
  version: AppVersion | null;
  error: string | null;
}> {
  try {
    const currentVersion = Constants.expoConfig?.version || '1.0.0';
    const platform = Platform.OS as 'ios' | 'android';

    if (platform === 'web') {
      return { hasUpdate: false, isCritical: false, version: null, error: null };
    }

    const { data: latestVersions, error } = await supabase
      .from('app_versions')
      .select('*')
      .or(`platform.eq.${platform},platform.eq.all`)
      .order('released_at', { ascending: false })
      .limit(1);

    if (error) {
      logger.error('AppVersion', 'Error checking for updates:', error);
      return { hasUpdate: false, isCritical: false, version: null, error: error.message };
    }

    if (!latestVersions || latestVersions.length === 0) {
      return { hasUpdate: false, isCritical: false, version: null, error: null };
    }

    const latestVersion = latestVersions[0] as AppVersion;

    const hasUpdate = compareVersions(latestVersion.version, currentVersion) > 0;
    const isCritical = latestVersion.is_critical || false;

    if (hasUpdate) {
      logger.info('AppVersion', `Update available: ${currentVersion} -> ${latestVersion.version}`);

      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        await markUpdateNotified(user.id, latestVersion.id);
      }
    }

    return {
      hasUpdate,
      isCritical,
      version: hasUpdate ? latestVersion : null,
      error: null,
    };
  } catch (error) {
    logger.error('AppVersion', 'Exception checking for updates:', error);
    return {
      hasUpdate: false,
      isCritical: false,
      version: null,
      error: 'Failed to check for updates',
    };
  }
}

async function markUpdateNotified(userId: string, versionId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_app_updates')
      .upsert({
        user_id: userId,
        version_id: versionId,
        notified_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,version_id',
      });

    if (error) {
      logger.error('AppVersion', 'Error marking update notified:', error);
    }
  } catch (error) {
    logger.error('AppVersion', 'Exception marking update notified:', error);
  }
}

export async function markUpdateDismissed(versionId: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase
      .from('user_app_updates')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('version_id', versionId);

    if (error) {
      logger.error('AppVersion', 'Error marking update dismissed:', error);
    }
  } catch (error) {
    logger.error('AppVersion', 'Exception marking update dismissed:', error);
  }
}

export async function markAppUpdated(versionId: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase
      .from('user_app_updates')
      .update({ updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('version_id', versionId);

    if (error) {
      logger.error('AppVersion', 'Error marking app updated:', error);
    }
  } catch (error) {
    logger.error('AppVersion', 'Exception marking app updated:', error);
  }
}

function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }

  return 0;
}

export async function sendAppUpdateNotificationToAllUsers(versionId: string): Promise<{
  success: boolean;
  sent: number;
  error: string | null;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, sent: 0, error: 'Not authenticated' };
    }

    const { data: version, error: versionError } = await supabase
      .from('app_versions')
      .select('*')
      .eq('id', versionId)
      .single();

    if (versionError || !version) {
      return { success: false, sent: 0, error: 'Version not found' };
    }

    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, expo_push_token, notification_enabled, notification_preferences')
      .eq('notification_enabled', true)
      .not('expo_push_token', 'is', null);

    if (usersError || !users) {
      return { success: false, sent: 0, error: 'Failed to fetch users' };
    }

    const eligibleUsers = users.filter(u => {
      const prefs = u.notification_preferences || {};
      return prefs.app_updates !== false;
    });

    if (eligibleUsers.length === 0) {
      return { success: true, sent: 0, error: null };
    }

    const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
    const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey;

    if (!supabaseUrl || !supabaseAnonKey) {
      return { success: false, sent: 0, error: 'Supabase config not found' };
    }

    const notificationTitle = version.is_critical
      ? '🔴 Critical Update Available'
      : '🎉 New Version Available';

    const notificationBody = `Zenlit ${version.version} is now available!`;

    const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        userIds: eligibleUsers.map(u => u.id),
        type: 'app_update',
        title: notificationTitle,
        body: notificationBody,
        data: {
          versionId: version.id,
          version: version.version,
          isCritical: version.is_critical,
          releaseNotes: version.release_notes,
        },
        priority: version.is_critical ? 'high' : 'default',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('AppVersion', 'Failed to send notifications:', errorText);
      return { success: false, sent: 0, error: errorText };
    }

    const result = await response.json();

    logger.info('AppVersion', `Sent update notifications to ${result.sent} users`);

    return {
      success: true,
      sent: result.sent || 0,
      error: null,
    };
  } catch (error) {
    logger.error('AppVersion', 'Exception sending update notifications:', error);
    return {
      success: false,
      sent: 0,
      error: 'Failed to send notifications',
    };
  }
}

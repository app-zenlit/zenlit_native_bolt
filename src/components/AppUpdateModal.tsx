import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { theme } from '../styles/theme';
import type { AppVersion } from '../services/appVersionService';

interface AppUpdateModalProps {
  visible: boolean;
  version: AppVersion | null;
  isCritical: boolean;
  onDismiss?: () => void;
}

export const AppUpdateModal: React.FC<AppUpdateModalProps> = ({
  visible,
  version,
  isCritical,
  onDismiss,
}) => {
  if (!version) return null;

  const handleUpdate = async () => {
    if (version.download_url) {
      await Linking.openURL(version.download_url);
    } else {
      const storeUrl = Platform.select({
        ios: 'https://apps.apple.com/app/zenlit/id123456789',
        android: 'https://play.google.com/store/apps/details?id=com.arjungowdal4601.zenlit',
      });

      if (storeUrl) {
        await Linking.openURL(storeUrl);
      }
    }

    if (!isCritical && onDismiss) {
      onDismiss();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isCritical ? undefined : onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.icon}>{isCritical ? '🔴' : '🎉'}</Text>
            <Text style={styles.title}>
              {isCritical ? 'Critical Update Required' : 'Update Available'}
            </Text>
          </View>

          <View style={styles.content}>
            <Text style={styles.versionText}>
              Version {version.version} is now available
            </Text>

            {version.release_notes && (
              <View style={styles.releaseNotes}>
                <Text style={styles.releaseNotesTitle}>What's New:</Text>
                <Text style={styles.releaseNotesText}>{version.release_notes}</Text>
              </View>
            )}

            {isCritical && (
              <View style={styles.criticalWarning}>
                <Text style={styles.criticalWarningText}>
                  This update includes important security fixes and improvements. Please update now
                  to continue using Zenlit.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.updateButton]}
              onPress={handleUpdate}
            >
              <Text style={styles.updateButtonText}>
                {isCritical ? 'Update Now' : 'Update'}
              </Text>
            </TouchableOpacity>

            {!isCritical && onDismiss && (
              <TouchableOpacity
                style={[styles.button, styles.dismissButton]}
                onPress={onDismiss}
              >
                <Text style={styles.dismissButtonText}>Later</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  header: {
    alignItems: 'center',
    paddingTop: 32,
    paddingHorizontal: 24,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  versionText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
  },
  releaseNotes: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  releaseNotesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#60a5fa',
    marginBottom: 8,
  },
  releaseNotesText: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 20,
  },
  criticalWarning: {
    backgroundColor: '#7f1d1d',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  criticalWarningText: {
    fontSize: 14,
    color: '#fca5a5',
    lineHeight: 20,
  },
  actions: {
    padding: 24,
    paddingTop: 0,
    gap: 12,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateButton: {
    backgroundColor: '#60a5fa',
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  dismissButton: {
    backgroundColor: '#1e293b',
  },
  dismissButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#94a3b8',
  },
});

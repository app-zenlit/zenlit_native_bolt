import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View, Image, ImageSourcePropType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, FontAwesome6 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ImageUploadDialog from '../src/components/ImageUploadDialog';
import { SOCIAL_PLATFORMS } from '../src/constants/socialPlatforms';
import GradientTitle from '../src/components/GradientTitle';

const FALLBACK_AVATAR = 'https://api.dicebear.com/7.x/avataaars/png?seed=Alex&backgroundColor=b6e3f4';

const EditProfileScreen: React.FC = () => {
  const router = useRouter();

  // Local state (UI-only)
  const [displayName, setDisplayName] = useState('Alex Johnson');
  const [bio, setBio] = useState('Front-end developer passionate about building delightful UIs.');
  const [bannerImage, setBannerImage] = useState<ImageSourcePropType | null>(null);
  const [profileImage, setProfileImage] = useState<string>(FALLBACK_AVATAR);

  const [showInstagramModal, setShowInstagramModal] = useState(false);
  const [showTwitterModal, setShowTwitterModal] = useState(false);
  const [showLinkedinModal, setShowLinkedinModal] = useState(false);

  const [instagram, setInstagram] = useState('');
  const [twitter, setTwitter] = useState('');
  const [linkedin, setLinkedin] = useState('');

  const [showSuccess, setShowSuccess] = useState(false);
  const [showAvatarDialog, setShowAvatarDialog] = useState(false);
  const [showBannerDialog, setShowBannerDialog] = useState(false);

  const handleBack = () => {
    router.push('/profile');
  };

  const handleSave = () => {
    const payload = {
      displayName,
      bio,
      social: { instagram, x: twitter, linkedin },
      profileImage,
      bannerImage,
    };
    console.log('Edit Profile save', payload);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  const openBannerMenu = () => setShowBannerDialog(true);
  const openProfileMenu = () => setShowAvatarDialog(true);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={22} color="#ffffff" />
          </Pressable>
          <GradientTitle text="Edit Profile" style={styles.headerTitle} />
          <View style={{ width: 44 }} />
        </View>
      </SafeAreaView>

      {showSuccess && (
        <View style={styles.successBar}>
          <Feather name="check" size={18} color="#ffffff" />
          <Text style={styles.successText}>Profile updated successfully!</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Banner area */}
        <View style={styles.bannerWrapper}>
          {bannerImage ? (
            <Image source={bannerImage} style={styles.bannerImage} resizeMode="cover" />
          ) : (
            <View style={[styles.bannerImage, styles.bannerFallback]} />
          )}
          <Pressable style={styles.bannerOverlay} onPress={openBannerMenu}>
            <View style={styles.overlayCircle}>
              <Feather name="camera" size={18} color="#ffffff" />
            </View>
          </Pressable>
          {/* Avatar */}
          <View style={styles.avatarWrapper}>
            <Pressable onPress={openProfileMenu} style={styles.avatarButton}>
              <Image source={{ uri: profileImage }} style={styles.avatar} />
              <View style={styles.avatarCamera}>
                <View style={styles.overlayCircle}>
                  <Feather name="camera" size={16} color="#ffffff" />
                </View>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Form */}
        <View style={styles.formSection}>
          <Text style={styles.label}>Display Name</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor="#64748b"
            style={styles.input}
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Bio</Text>
          <TextInput
            value={bio}
            onChangeText={(text) => setBio(text.slice(0, 500))}
            placeholder="Tell people about yourself"
            placeholderTextColor="#64748b"
            style={[styles.input, styles.textarea]}
            multiline
            maxLength={500}
          />
          <Text style={styles.charCount}>{bio.length}/500</Text>
        </View>

        {/* Social links */}
        <View style={styles.socialSection}>
          <GradientTitle text="Social Links" style={styles.sectionTitle} />

          {/* Instagram */}
          <View style={styles.socialCard}>
            {/* Instagram gradient badge */}
            <View style={[styles.socialBadge, styles.instagramBadge]}>
              {SOCIAL_PLATFORMS.instagram.renderIcon({ size: 20, color: '#ffffff' })}
            </View>
            <View style={styles.socialContent}>
              <Text style={styles.socialLabel}>Instagram</Text>
              <Text style={styles.socialValue}>{instagram ? instagram : 'No link added'}</Text>
            </View>
            <Pressable style={styles.editButton} onPress={() => setShowInstagramModal(true)}>
              <Feather name="edit-3" size={16} color="#ffffff" />
            </Pressable>
          </View>

          {/* Twitter/X */}
          <View style={styles.socialCard}>
            <View style={[styles.socialBadge, styles.outlinedBadge]}>
              {SOCIAL_PLATFORMS.twitter.renderIcon({ size: 20, color: '#ffffff' })}
            </View>
            <View style={styles.socialContent}>
              <Text style={styles.socialLabel}>X</Text>
              <Text style={styles.socialValue}>{twitter ? twitter : 'No link added'}</Text>
            </View>
            <Pressable style={styles.editButton} onPress={() => setShowTwitterModal(true)}>
              <Feather name="edit-3" size={16} color="#ffffff" />
            </Pressable>
          </View>

          {/* LinkedIn */}
          <View style={styles.socialCard}>
            <View style={[styles.socialBadge, { backgroundColor: SOCIAL_PLATFORMS.linkedin.style.backgroundColor }] }>
              {SOCIAL_PLATFORMS.linkedin.renderIcon({ size: 20, color: '#ffffff' })}
            </View>
            <View style={styles.socialContent}>
              <Text style={styles.socialLabel}>LinkedIn</Text>
              <Text style={styles.socialValue}>{linkedin ? linkedin : 'No link added'}</Text>
            </View>
            <Pressable style={styles.editButton} onPress={() => setShowLinkedinModal(true)}>
              <Feather name="edit-3" size={16} color="#ffffff" />
            </Pressable>
          </View>
        </View>

        <View style={styles.footerActions}>
          <Pressable style={[styles.actionButton, styles.cancelButton]} onPress={() => router.back()} accessibilityRole="button">
            <Text style={[styles.actionLabel, styles.cancelLabel]}>Cancel</Text>
          </Pressable>
          <Pressable style={[styles.actionButton, styles.saveButton]} onPress={handleSave} accessibilityRole="button">
            <Text style={styles.actionLabel}>Save</Text>
          </Pressable>
        </View>
      </ScrollView>

  {/* Instagram Modal */}
      <Modal transparent visible={showInstagramModal} animationType="fade" onRequestClose={() => setShowInstagramModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Instagram</Text>
            <TextInput
              value={instagram}
              onChangeText={setInstagram}
              placeholder="@username or URL"
              placeholderTextColor="#64748b"
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalBtn, styles.modalCancel]} onPress={() => setShowInstagramModal(false)}>
                <Text style={styles.modalBtnLabel}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.modalSave]} onPress={() => setShowInstagramModal(false)}>
                <Text style={styles.modalBtnLabel}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Twitter Modal */}
      <Modal transparent visible={showTwitterModal} animationType="fade" onRequestClose={() => setShowTwitterModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>X (Twitter)</Text>
            <TextInput
              value={twitter}
              onChangeText={setTwitter}
              placeholder="@handle or URL"
              placeholderTextColor="#64748b"
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalBtn, styles.modalCancel]} onPress={() => setShowTwitterModal(false)}>
                <Text style={styles.modalBtnLabel}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.modalSave]} onPress={() => setShowTwitterModal(false)}>
                <Text style={styles.modalBtnLabel}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* LinkedIn Modal */}
      <Modal transparent visible={showLinkedinModal} animationType="fade" onRequestClose={() => setShowLinkedinModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>LinkedIn</Text>
            <TextInput
              value={linkedin}
              onChangeText={setLinkedin}
              placeholder="Profile URL"
              placeholderTextColor="#64748b"
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalBtn, styles.modalCancel]} onPress={() => setShowLinkedinModal(false)}>
                <Text style={styles.modalBtnLabel}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.modalSave]} onPress={() => setShowLinkedinModal(false)}>
                <Text style={styles.modalBtnLabel}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Avatar Options Dialog */}
      <ImageUploadDialog
        visible={showAvatarDialog}
        onClose={() => setShowAvatarDialog(false)}
        title="Profile Picture"
        currentImage={profileImage}
        onImageSelected={(uri) => {
          setProfileImage(uri);
          setShowAvatarDialog(false);
        }}
        onRemove={() => {
          setProfileImage(FALLBACK_AVATAR);
          setShowAvatarDialog(false);
        }}
        showRemoveOption={true}
      />

      {/* Banner Options Dialog */}
      <ImageUploadDialog
        visible={showBannerDialog}
        onClose={() => setShowBannerDialog(false)}
        title="Banner Image"
        currentImage={bannerImage ? (typeof bannerImage === 'object' && 'uri' in bannerImage ? bannerImage.uri : '') : ''}
        onImageSelected={(uri) => {
          setBannerImage({ uri });
          setShowBannerDialog(false);
        }}
        onRemove={() => {
          setBannerImage(null);
          setShowBannerDialog(false);
        }}
        showRemoveOption={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  safeArea: { backgroundColor: '#000000' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12,
  },
  headerButton: {
    width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(30, 41, 59, 0.6)',
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#ffffff' },
  successBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#16a34a', paddingHorizontal: 16, paddingVertical: 10 },
  successText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  content: { paddingBottom: 120 },
  bannerWrapper: { position: 'relative', marginBottom: 60 },
  bannerImage: { width: '100%', height: 200, borderRadius: 0 },
  bannerFallback: { backgroundColor: '#1f2937' },
  bannerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  overlayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.35)' },
  avatarWrapper: { position: 'absolute', left: 20, bottom: -50 },
  avatarButton: { borderRadius: 8, borderWidth: 2, borderColor: '#000000', padding: 2, backgroundColor: '#000000' },
  avatar: { width: 100, height: 100, borderRadius: 8, backgroundColor: '#111827' },
  avatarCamera: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  formSection: { paddingHorizontal: 20 },
  label: { color: '#ffffff', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { color: '#ffffff', backgroundColor: '#000000', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.35)' },
  textarea: { minHeight: 100, textAlignVertical: 'top' },
  socialSection: { marginTop: 24, paddingHorizontal: 20 },
  sectionTitle: { color: '#ffffff', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  socialRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  socialCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.35)', borderRadius: 12, backgroundColor: '#000000', marginBottom: 12 },
  socialIconWrap: { display: 'none' },
  socialBadge: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.35)', backgroundColor: '#000000' },
  instagramBadge: { backgroundColor: '#dc2743' },
  outlinedBadge: { backgroundColor: '#000000', borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.35)' },
  socialContent: { flex: 1, minWidth: 0 },
  socialLabel: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  socialValue: { color: '#94a3b8', fontSize: 14 },
  charCount: { color: '#94a3b8', fontSize: 12, alignSelf: 'flex-end', marginTop: 4 },
  editButton: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.85)', borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.35)' },
  footerActions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 24 },
  actionButton: { flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderWidth: 1 },
  cancelButton: { backgroundColor: '#000000', borderColor: 'rgba(148, 163, 184, 0.35)' },
  saveButton: { backgroundColor: '#6d28d9', borderColor: '#6d28d9' },
  actionLabel: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  cancelLabel: { color: '#cbd5f5' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '90%', maxWidth: 420, backgroundColor: '#000000', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.35)' },
  modalTitle: { color: '#ffffff', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  modalInput: { color: '#ffffff', backgroundColor: '#000000', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.35)' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalBtn: { flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  modalCancel: { backgroundColor: '#000000', borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.35)' },
  modalSave: { backgroundColor: '#6d28d9' },
  modalBtnLabel: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
});

export default EditProfileScreen;
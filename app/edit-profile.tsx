import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View, Image, ImageSourcePropType, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ImageUploadDialog from '../src/components/ImageUploadDialog';
import { SOCIAL_PLATFORMS, extractUsername } from '../src/constants/socialPlatforms';
import GradientTitle from '../src/components/GradientTitle';
import { supabase } from '../src/lib/supabase';
import { getCurrentUserProfile, updateSocialLinks, uploadImage, deleteImageFromStorage, updateProfileDisplayName } from '../src/services';
import { useProfile } from '../src/contexts/ProfileContext';
import { compressImage, MAX_IMAGE_SIZE_BYTES, base64ToUint8Array, type CompressedImage } from '../src/utils/imageCompression';

const EditProfileScreen: React.FC = () => {
  const router = useRouter();
  const { refresh } = useProfile();

  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [bannerImage, setBannerImage] = useState<ImageSourcePropType | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const [originalDisplayName, setOriginalDisplayName] = useState('');
  const [originalBio, setOriginalBio] = useState('');
  const [originalBannerImage, setOriginalBannerImage] = useState<ImageSourcePropType | null>(null);
  const [originalProfileImage, setOriginalProfileImage] = useState<string | null>(null);
  const [originalInstagram, setOriginalInstagram] = useState('');
  const [originalTwitter, setOriginalTwitter] = useState('');
  const [originalLinkedin, setOriginalLinkedin] = useState('');

  const [pendingBannerRemoval, setPendingBannerRemoval] = useState(false);
  const [pendingProfileRemoval, setPendingProfileRemoval] = useState(false);
  const [pendingBannerUpload, setPendingBannerUpload] = useState<CompressedImage | null>(null);
  const [pendingAvatarUpload, setPendingAvatarUpload] = useState<CompressedImage | null>(null);
  const [oldBannerUrl, setOldBannerUrl] = useState<string | null>(null);
  const [oldProfileUrl, setOldProfileUrl] = useState<string | null>(null);

  const [showInstagramModal, setShowInstagramModal] = useState(false);
  const [showTwitterModal, setShowTwitterModal] = useState(false);
  const [showLinkedinModal, setShowLinkedinModal] = useState(false);

  const [instagram, setInstagram] = useState('');
  const [twitter, setTwitter] = useState('');
  const [linkedin, setLinkedin] = useState('');

  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'warning' | 'error' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showImageUploadDialog, setShowImageUploadDialog] = useState(false);
  const [uploadType, setUploadType] = useState<'avatar' | 'banner'>('avatar');

  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const clearSuccessTimeout = useCallback(() => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
  }, []);

  const clearToastTimeout = useCallback(() => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
  }, []);

  const showToastMessage = useCallback(
    (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', duration = 2500) => {
      clearToastTimeout();
      if (!mountedRef.current) {
        return;
      }
      setToast({ message, type });

      if (duration > 0) {
        toastTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            setToast(null);
            toastTimeoutRef.current = null;
          }
        }, duration);
      }
    },
    [clearToastTimeout],
  );

  useEffect(() => {
    mountedRef.current = true;
    loadUserData();
    return () => {
      mountedRef.current = false;
      clearSuccessTimeout();
      clearToastTimeout();
    };
  }, [clearSuccessTimeout, clearToastTimeout]);

  const loadUserData = async () => {
    setLoading(true);
    try {
      const { profile, socialLinks } = await getCurrentUserProfile();

      if (profile && mountedRef.current) {
        const dName = profile.display_name;
        const bioText = socialLinks?.bio || '';
        const profImg = socialLinks?.profile_pic_url || null;
        const bannImg = socialLinks?.banner_url ? { uri: socialLinks.banner_url } : null;
        const insta = socialLinks?.instagram || '';
        const twit = socialLinks?.x_twitter || '';
        const link = socialLinks?.linkedin || '';

        setDisplayName(dName);
        setBio(bioText);
        setProfileImage(profImg);
        setBannerImage(bannImg);
        setInstagram(insta);
        setTwitter(twit);
        setLinkedin(link);

        setOriginalDisplayName(dName);
        setOriginalBio(bioText);
        setOriginalProfileImage(profImg);
        setOriginalBannerImage(bannImg);
        setOriginalInstagram(insta);
        setOriginalTwitter(twit);
        setOriginalLinkedin(link);

        setOldProfileUrl(profImg);
        setOldBannerUrl(socialLinks?.banner_url || null);
        setPendingProfileRemoval(false);
        setPendingBannerRemoval(false);
        setPendingAvatarUpload(null);
        setPendingBannerUpload(null);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

    const uploadImageIfNeeded = async (
    image: CompressedImage | null | undefined,
    filePrefix: 'avatar' | 'banner',
  ): Promise<string | undefined> => {
    try {
      if (!image) {
        return undefined;
      }

      let workingImage = image;

      if (
        workingImage.size > MAX_IMAGE_SIZE_BYTES ||
        workingImage.metadata.compressedSize > MAX_IMAGE_SIZE_BYTES
      ) {
        workingImage = await compressImage(workingImage.uri);
      }

      const fileName = `${filePrefix}-${Date.now()}.jpg`;
      const uploadBody = workingImage.base64
        ? base64ToUint8Array(workingImage.base64)
        : workingImage.uri;

      const { url, error } = await uploadImage(uploadBody, 'profile-images', fileName, {
        contentType: workingImage.mimeType,
      });

      if (error || !url) {
        throw error ?? new Error('Upload failed');
      }

      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log(`[profile-upload/${filePrefix}]`, workingImage.metadata);
      }

      return url;
    } catch (error) {
      console.error('Failed to upload image:', error);
      return undefined;
    }
  };

  const handleSave = async () => {
    if (isSaving) {
      return;
    }

    clearSuccessTimeout();
    setIsSaving(true);

    let previousAvatarUrl = oldProfileUrl;
    let previousBannerUrl = oldBannerUrl;
    let uploadedAvatarUrl: string | undefined;
    let uploadedBannerUrl: string | undefined;
    let socialLinksUpdated = false;

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const trimmedDisplayName = displayName.trim();
      const displayNameChanged = trimmedDisplayName !== originalDisplayName;

      if (pendingAvatarUpload) {
        uploadedAvatarUrl = await uploadImageIfNeeded(pendingAvatarUpload, 'avatar');
        if (!uploadedAvatarUrl) {
          throw new Error('Failed to upload the new profile picture. Please try again.');
        }
      }

      if (pendingBannerUpload) {
        uploadedBannerUrl = await uploadImageIfNeeded(pendingBannerUpload, 'banner');
        if (!uploadedBannerUrl) {
          throw new Error('Failed to upload the new banner image. Please try again.');
        }
      }

      const warnings: string[] = [];

      const deleteWithRetry = async (url: string | null, label: 'profile picture' | 'banner image') => {
        if (!url) {
          return;
        }

        let attempt = 0;
        let lastError: Error | null = null;

        while (attempt < 2) {
          attempt += 1;
          const { success, error } = await deleteImageFromStorage(url, 'profile-images');
          if (success) {
            return;
          }
          lastError = error ?? null;
        }

        if (lastError) {
          console.warn(`Failed to delete ${label}:`, lastError);
        } else {
          console.warn(`Failed to delete ${label}: unknown error`);
        }

        warnings.push(`We couldn't remove your previous ${label}. It may remain temporarily.`);
      };

      const shouldDeleteAvatar =
        pendingProfileRemoval ||
        (uploadedAvatarUrl && previousAvatarUrl && previousAvatarUrl !== uploadedAvatarUrl);
      const shouldDeleteBanner =
        pendingBannerRemoval ||
        (uploadedBannerUrl && previousBannerUrl && previousBannerUrl !== uploadedBannerUrl);

      const trimmedBio = bio?.trim() ?? '';
      const trimmedInstagram = instagram?.trim() ?? '';
      const trimmedTwitter = twitter?.trim() ?? '';
      const trimmedLinkedin = linkedin?.trim() ?? '';

      const payload: Record<string, any> = {
        bio: trimmedBio || null,
        instagram: trimmedInstagram || null,
        x_twitter: trimmedTwitter || null,
        linkedin: trimmedLinkedin || null,
      };

      if (pendingProfileRemoval) {
        payload.profile_pic_url = null;
      } else if (uploadedAvatarUrl !== undefined) {
        payload.profile_pic_url = uploadedAvatarUrl;
      }

      if (pendingBannerRemoval) {
        payload.banner_url = null;
      } else if (uploadedBannerUrl !== undefined) {
        payload.banner_url = uploadedBannerUrl;
      }

      const { error: updateError, socialLinks } = await updateSocialLinks(payload);

      if (updateError) {
        throw updateError;
      }
      socialLinksUpdated = true;

      const nextProfileUrl =
        pendingProfileRemoval
          ? null
          : uploadedAvatarUrl !== undefined
            ? uploadedAvatarUrl
            : socialLinks?.profile_pic_url ?? previousAvatarUrl ?? null;

      const nextBannerUrl =
        pendingBannerRemoval
          ? null
          : uploadedBannerUrl !== undefined
            ? uploadedBannerUrl
            : socialLinks?.banner_url ?? previousBannerUrl ?? null;

      setProfileImage(nextProfileUrl);
      setOriginalProfileImage(nextProfileUrl);
      setOldProfileUrl(nextProfileUrl);

      const bannerSource = nextBannerUrl ? { uri: nextBannerUrl } : null;
      setBannerImage(bannerSource);
      setOriginalBannerImage(bannerSource);
      setOldBannerUrl(nextBannerUrl);

      setBio(trimmedBio);
      setOriginalBio(trimmedBio);
      setInstagram(trimmedInstagram);
      setOriginalInstagram(trimmedInstagram);
      setTwitter(trimmedTwitter);
      setOriginalTwitter(trimmedTwitter);
      setLinkedin(trimmedLinkedin);
      setOriginalLinkedin(trimmedLinkedin);

      setPendingProfileRemoval(false);
      setPendingBannerRemoval(false);
      setPendingAvatarUpload(null);
      setPendingBannerUpload(null);

      if (shouldDeleteAvatar) {
        await deleteWithRetry(previousAvatarUrl, 'profile picture');
      }

      if (shouldDeleteBanner) {
        await deleteWithRetry(previousBannerUrl, 'banner image');
      }

      if (displayNameChanged) {
        const { error: nameError } = await updateProfileDisplayName(trimmedDisplayName);
        if (nameError) {
          throw nameError;
        }
      }

      setDisplayName(trimmedDisplayName);
      setOriginalDisplayName(trimmedDisplayName);

      await refresh(true);
      showToastMessage('Profile updated successfully.', 'success');

      if (warnings.length > 0) {
        const warningMessage = warnings.join(' ');
        setTimeout(() => {
          if (mountedRef.current) {
            showToastMessage(warningMessage, 'warning', 4000);
          }
        }, 2600);
      }

      const navigationDelay = warnings.length > 0 ? 4500 : 1500;

      successTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          router.back();
          successTimeoutRef.current = null;
        }
      }, navigationDelay);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      if (!socialLinksUpdated) {
        const cleanupTargets: Array<{ url: string | undefined; previous: string | null; label: 'profile picture' | 'banner image' }> = [
          { url: uploadedAvatarUrl, previous: previousAvatarUrl, label: 'profile picture' },
          { url: uploadedBannerUrl, previous: previousBannerUrl, label: 'banner image' },
        ];

        for (const target of cleanupTargets) {
          if (target.url && target.url !== target.previous) {
            const { success, error: cleanupError } = await deleteImageFromStorage(target.url, 'profile-images');
            if (!success && cleanupError) {
              console.warn(`Cleanup failed for pending ${target.label}:`, cleanupError);
            }
          }
        }
      }
      clearSuccessTimeout();
      const message =
        typeof error?.message === 'string'
          ? error.message
          : 'Failed to update profile. Please try again.';
      showToastMessage(message, 'error', 3500);
    } finally {
      if (mountedRef.current) {
        setIsSaving(false);
      }
    }
  };

  const handleCancel = () => {
    setDisplayName(originalDisplayName);
    setBio(originalBio);
    setProfileImage(originalProfileImage);
    setBannerImage(originalBannerImage);
    setInstagram(originalInstagram);
    setTwitter(originalTwitter);
    setLinkedin(originalLinkedin);
    setPendingBannerRemoval(false);
    setPendingProfileRemoval(false);
    setPendingBannerUpload(null);
    setPendingAvatarUpload(null);
    clearToastTimeout();
    setToast(null);
    router.back();
  };

  const handleBack = () => {
    handleCancel();
  };

  const openBannerMenu = () => {
    setUploadType('banner');
    setShowImageUploadDialog(true);
  };

  const openProfileMenu = () => {
    setUploadType('avatar');
    setShowImageUploadDialog(true);
  };

  const handleImageSelected = (image: CompressedImage | null) => {
    const finalUri = image?.uri ?? null;
    const hasImage = Boolean(image);

    if (uploadType === 'avatar') {
      setProfileImage(finalUri);
      setPendingAvatarUpload(image ?? null);
      setPendingProfileRemoval(!hasImage);
      if (typeof __DEV__ !== 'undefined' && __DEV__ && image) {
        console.log('[profile-image/avatar]', image.metadata);
      }
      showToastMessage(
        hasImage
          ? 'New profile picture selected. Save to apply.'
          : 'Profile picture removed (pending). Save to confirm.',
        'info',
      );
    } else {
      const bannerSource = image ? { uri: image.uri } : null;
      setBannerImage(bannerSource);
      setPendingBannerUpload(image ?? null);
      setPendingBannerRemoval(!hasImage);
      if (typeof __DEV__ !== 'undefined' && __DEV__ && image) {
        console.log('[profile-image/banner]', image.metadata);
      }
      showToastMessage(
        hasImage
          ? 'New banner image selected. Save to apply.'
          : 'Banner image removed (pending). Save to confirm.',
        'info',
      );
    }
  };

  const handleImageRemove = () => {
    if (uploadType === 'avatar') {
      setProfileImage(null);
      setPendingProfileRemoval(true);
      setPendingAvatarUpload(null);
      showToastMessage('Profile picture removed (pending). Save to confirm.', 'info');
    } else {
      setBannerImage(null);
      setPendingBannerRemoval(true);
      setPendingBannerUpload(null);
      showToastMessage('Banner image removed (pending). Save to confirm.', 'info');
    }
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <Pressable onPress={handleBack} style={styles.headerButton}>
              <Feather name="arrow-left" size={22} color="#ffffff" />
            </Pressable>
            <GradientTitle text="Edit Profile" style={styles.headerTitle} />
            <View style={{ width: 44 }} />
          </View>
        </SafeAreaView>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#60a5fa" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

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

      {toast ? (
        <View
          style={[
            styles.toastBar,
            toast.type === 'success'
              ? styles.toastSuccess
              : toast.type === 'error'
                ? styles.toastError
                : toast.type === 'warning'
                  ? styles.toastWarning
                  : styles.toastInfo,
          ]}
        >
          <Feather
            name={
              toast.type === 'success'
                ? 'check-circle'
                : toast.type === 'error'
                  ? 'alert-triangle'
                  : toast.type === 'warning'
                    ? 'alert-circle'
                    : 'info'
            }
            size={18}
            color="#ffffff"
          />
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
          <View style={styles.avatarWrapper}>
            <Pressable onPress={openProfileMenu} style={styles.avatarButton}>
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Feather name="user" size={44} color="#64748b" />
                </View>
              )}
              <View style={styles.avatarCamera}>
                <View style={styles.overlayCircle}>
                  <Feather name="camera" size={16} color="#ffffff" />
                </View>
              </View>
            </Pressable>
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={[styles.label, { marginTop: 0 }]}>Display Name</Text>
          <TextInput
            value={displayName}
            onChangeText={(text) => setDisplayName(text.slice(0, 50))}
            placeholder="Your display name"
            placeholderTextColor="#475569"
            style={styles.input}
            maxLength={50}
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Bio</Text>
          <TextInput
            value={bio}
            onChangeText={(text) => setBio(text.slice(0, 500))}
            placeholder="Tell about yourself..."
            placeholderTextColor="#475569"
            style={[styles.input, styles.textarea]}
            multiline
            maxLength={500}
          />
          <Text style={styles.charCount}>{bio.length}/500</Text>
        </View>

        <View style={styles.socialSection}>
          <GradientTitle text="Social Links" style={styles.sectionTitle} />

          <View style={styles.socialCard}>
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

          <View style={styles.socialCard}>
            <View style={[styles.socialBadge, { backgroundColor: SOCIAL_PLATFORMS.linkedin.style.backgroundColor }]}>
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
          <Pressable style={[styles.actionButton, styles.cancelButton]} onPress={handleCancel} accessibilityRole="button">
            <Text style={[styles.actionLabel, styles.cancelLabel]}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.saveButton, isSaving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={isSaving}
            accessibilityRole="button"
          >
            <Text style={styles.actionLabel}>{isSaving ? 'Saving...' : 'Save'}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal transparent visible={showInstagramModal} animationType="fade" onRequestClose={() => setShowInstagramModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Instagram Username</Text>
            <TextInput
              value={instagram}
              onChangeText={(text) => setInstagram(extractUsername(text))}
              placeholder="username"
              placeholderTextColor="#64748b"
              style={styles.modalInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.modalHelper}>Will link to: instagram.com/{instagram || 'username'}</Text>
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

      <Modal transparent visible={showTwitterModal} animationType="fade" onRequestClose={() => setShowTwitterModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>X (Twitter) Username</Text>
            <TextInput
              value={twitter}
              onChangeText={(text) => setTwitter(extractUsername(text))}
              placeholder="username"
              placeholderTextColor="#64748b"
              style={styles.modalInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.modalHelper}>Will link to: x.com/{twitter || 'username'}</Text>
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

      <Modal transparent visible={showLinkedinModal} animationType="fade" onRequestClose={() => setShowLinkedinModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>LinkedIn Username</Text>
            <TextInput
              value={linkedin}
              onChangeText={(text) => setLinkedin(extractUsername(text))}
              placeholder="username"
              placeholderTextColor="#64748b"
              style={styles.modalInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.modalHelper}>Will link to: linkedin.com/in/{linkedin || 'username'}</Text>
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

      <ImageUploadDialog
        visible={showImageUploadDialog}
        onClose={() => setShowImageUploadDialog(false)}
        onImageSelected={handleImageSelected}
        title={uploadType === 'avatar' ? 'Profile Picture' : 'Banner Image'}
        currentImage={uploadType === 'avatar' ? profileImage : (bannerImage as any)?.uri}
        onRemove={handleImageRemove}
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#94a3b8', fontSize: 16, marginTop: 12 },
  toastBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
  },
  toastText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  toastSuccess: {
    backgroundColor: '#166534',
  },
  toastInfo: {
    backgroundColor: '#1e3a8a',
  },
  toastWarning: {
    backgroundColor: '#92400e',
  },
  toastError: {
    backgroundColor: '#7f1d1d',
  },
  content: { paddingBottom: 120 },
  bannerWrapper: { position: 'relative', marginBottom: 60 },
  bannerImage: { width: '100%', height: 200, borderRadius: 0 },
  bannerFallback: { backgroundColor: '#1f2937' },
  bannerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  overlayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.35)' },
  avatarWrapper: { position: 'absolute', left: 20, bottom: -50 },
  avatarButton: { borderRadius: 8, borderWidth: 2, borderColor: '#000000', padding: 2, backgroundColor: '#000000' },
  avatar: { width: 100, height: 100, borderRadius: 8, backgroundColor: '#111827' },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b' },
  avatarCamera: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  formSection: { paddingHorizontal: 20 },
  label: { color: '#ffffff', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { color: '#ffffff', backgroundColor: '#000000', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.35)' },
  textarea: { minHeight: 100, textAlignVertical: 'top' },
  socialSection: { marginTop: 24, paddingHorizontal: 20 },
  sectionTitle: { color: '#ffffff', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  socialCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.35)', borderRadius: 12, backgroundColor: '#000000', marginBottom: 12 },
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
  modalHelper: { color: '#94a3b8', fontSize: 12, marginTop: 8 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalBtn: { flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  modalCancel: { backgroundColor: '#000000', borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.35)' },
  modalSave: { backgroundColor: '#6d28d9' },
  modalBtnLabel: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
});

export default EditProfileScreen;



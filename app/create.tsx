import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StatusBar, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AppHeader } from '../src/components/AppHeader';
import { PostComposer, PostComposerSharePayload } from '../src/components/PostComposer';
import SuccessPopup from '../src/components/SuccessPopup';
import { theme } from '../src/styles/theme';
import { createPost, getCurrentUserProfile, uploadImage } from '../src/services';
import { compressImage, MAX_IMAGE_SIZE_BYTES, base64ToUint8Array, type CompressedImage } from '../src/utils/imageCompression';

const uploadPostImageIfNeeded = async (image: CompressedImage | null | undefined): Promise<string | undefined> => {
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

  const fileName = `post-${Date.now()}.jpg`;
  const uploadBody = workingImage.base64 ? base64ToUint8Array(workingImage.base64) : workingImage.uri;
  const { url, error } = await uploadImage(uploadBody, 'post-images', fileName, {
    contentType: workingImage.mimeType,
  });

  if (error || !url) {
    throw error ?? new Error('Upload failed');
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('[post-image/compression]', workingImage.metadata);
  }

  return url;
};

const CreateScreen: React.FC = () => {
  const router = useRouter();
  const [author, setAuthor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [successVisible, setSuccessVisible] = useState(false);

  useEffect(() => {
    loadAuthor();
  }, []);

  const loadAuthor = async () => {
    const { profile, socialLinks } = await getCurrentUserProfile();

    if (profile) {
      setAuthor({
        name: profile.display_name,
        username: profile.user_name,
        avatar: socialLinks?.profile_pic_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.display_name)}&background=random&color=fff&size=128`,
      });
    }

    setLoading(false);
  };

  const handleShare = useCallback(async ({ content, image }: PostComposerSharePayload) => {
    const trimmed = content.trim();
    if (!trimmed.length) {
      Alert.alert('Error', 'Please enter some content.');
      return false;
    }

    let uploadedImageUrl: string | undefined;

    if (image) {
      uploadedImageUrl = await uploadPostImageIfNeeded(image);
      if (!uploadedImageUrl) {
        Alert.alert('Upload Failed', 'We could not upload your image. Please try again.');
        return false;
      }
    }

    const { post, error } = await createPost(trimmed, uploadedImageUrl);

    if (error || !post) {
      Alert.alert('Error', 'Failed to create post. Please try again.');
      console.error('Error creating post:', error);
      return false;
    }

    // Show success popup and auto navigate after it dismisses
    setSuccessVisible(true);
    return true;
  }, []);

  if (loading || !author) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <AppHeader title="Create Post" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <AppHeader title="Create Post" />

      <View style={styles.content}>
        <PostComposer author={author} onShare={handleShare} />
      </View>

      <SuccessPopup
        visible={successVisible}
        message="Post created successfully"
        onDismiss={() => {
          setSuccessVisible(false);
          router.push('/feed');
        }}
      />

      {/* Navigation is now rendered in the root layout */}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
});

export default CreateScreen;



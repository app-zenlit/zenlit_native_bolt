import React from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import AppHeader from '../src/components/AppHeader';
import FeedbackForm from '../src/components/feedback/FeedbackForm';

const FeedbackScreen: React.FC = () => {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <AppHeader title="Feedback" onBackPress={() => router.back()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.leadText}>
          Tell us what you think about Zenlit. We read every note.
        </Text>
        <FeedbackForm />
      </ScrollView>

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
    paddingHorizontal: 20,
    paddingBottom: 160,
    gap: 20,
  },
  leadText: {
    color: '#cbd5f5',
    fontSize: 15,
    lineHeight: 22,
  },
});

export default FeedbackScreen;

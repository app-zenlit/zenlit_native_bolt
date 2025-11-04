import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '../src/components/AppHeader';
import { SocialProfileCard } from '../src/components/SocialProfileCard';
import VisibilitySheet from '../src/components/VisibilitySheet';
import { useVisibility } from '../src/contexts/VisibilityContext';
import { theme } from '../src/styles/theme';
import { getNearbyUsers, type NearbyUserData } from '../src/services';

const DEBOUNCE_DELAY = 120;

type SearchableUser = {
  user: NearbyUserData;
  lowerName: string;
  lowerUsername: string;
  lowerHandle: string;
};

const RadarScreen: React.FC = () => {
  const { selectedAccounts, isVisible, locationPermissionDenied } = useVisibility();
  const insets = useSafeAreaInsets();

  const [isSearchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSheetVisible, setSheetVisible] = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const loadNearbyUsers = useCallback(async () => {
    if (!isVisible || locationPermissionDenied) {
      setNearbyUsers([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const { users, error: fetchError } = await getNearbyUsers();

    if (fetchError) {
      setError(fetchError.message);
      setNearbyUsers([]);
    } else {
      setNearbyUsers(users);
    }

    setLoading(false);
  }, [isVisible, locationPermissionDenied]);

  useEffect(() => {
    loadNearbyUsers();
  }, [loadNearbyUsers]);

  const searchableUsers = useMemo<SearchableUser[]>(
    () =>
      nearbyUsers.map((user) => ({
        user,
        lowerName: user.name.toLowerCase(),
        lowerUsername: user.username.toLowerCase(),
        lowerHandle: `@${user.username.toLowerCase()}`,
      })),
    [nearbyUsers],
  );

  useEffect(() => {
    const trimmed = query.trim();
    const timer = setTimeout(() => {
      setDebouncedQuery(trimmed);
    }, DEBOUNCE_DELAY);

    return () => {
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    if (isSearchOpen) {
      inputRef.current?.focus();
    }
  }, [isSearchOpen]);

  const normalizedQuery = debouncedQuery.toLowerCase();
  const hasQuery = normalizedQuery.length > 0;

  const matchingUsers = useMemo(() => {
    if (!hasQuery) {
      return searchableUsers;
    }

    return searchableUsers.filter((entry) => {
      if (entry.lowerName.includes(normalizedQuery)) {
        return true;
      }
      if (entry.lowerUsername.includes(normalizedQuery)) {
        return true;
      }
      return entry.lowerHandle.includes(normalizedQuery);
    });
  }, [hasQuery, normalizedQuery, searchableUsers]);

  const filteredUsers = useMemo(() => {
    if (!hasQuery) {
      return nearbyUsers;
    }

    return matchingUsers.map((entry) => entry.user);
  }, [hasQuery, matchingUsers, nearbyUsers]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery('');
    setDebouncedQuery('');
  }, []);

  const handleToggleSearch = useCallback(() => {
    if (isSearchOpen) {
      closeSearch();
    } else {
      setQuery('');
      setDebouncedQuery('');
      setSearchOpen(true);
    }
  }, [closeSearch, isSearchOpen]);

  const handleOpenVisibility = useCallback(() => {
    if (isSearchOpen) {
      closeSearch();
    }
    setSheetVisible(true);
  }, [closeSearch, isSearchOpen]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <AppHeader
        title="Radar"
        onTitlePress={loadNearbyUsers}
        onToggleSearch={handleToggleSearch}
        isSearchActive={isSearchOpen}
        onOpenVisibility={handleOpenVisibility}
      />

      {isSearchOpen ? (
        <View style={styles.searchContainer}>
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search users..."
            placeholderTextColor={theme.colors.muted}
            style={styles.searchInput}
            returnKeyType="search"
            accessibilityLabel="Search users"
            autoCorrect={false}
            spellCheck={false}
            keyboardAppearance="dark"
          />
        </View>
      ) : null}

      {locationPermissionDenied ? (
        <View style={styles.centerContainer}>
          <Text style={styles.warningText}>Location access is needed</Text>
          <Text style={styles.warningDetail}>
            Turn on location access to see nearby users.
          </Text>
        </View>
      ) : !isVisible ? (
        <View style={styles.centerContainer}>
          <Text style={styles.warningText}>Radar visibility is off</Text>
          <Text style={styles.warningDetail}>
            Turn on visibility to appear on radar and see nearby users.
          </Text>
        </View>
      ) : loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#60a5fa" />
          <Text style={styles.loadingText}>Finding nearby users...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Error loading nearby users</Text>
          <Text style={styles.errorDetail}>{error}</Text>
        </View>
      ) : (
        <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SocialProfileCard
            user={item}
            selectedAccounts={selectedAccounts}
            borderRadius={10}
          />
        )}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: 160 + Math.max(insets.bottom, 12),
          paddingTop: theme.spacing.sm,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          hasQuery ? (
            <View style={styles.listEmpty}>
              <Text style={styles.listEmptyTitle}>No users found</Text>
              <Text style={styles.listEmptySubtitle}>
                Try a different name or handle.
              </Text>
            </View>
          ) : (
            <View style={styles.listEmpty}>
              <Text style={styles.listEmptyTitle}>No nearby users</Text>
              <Text style={styles.listEmptySubtitle}>
                No one is visible within your area at the moment.
              </Text>
            </View>
          )
        }
      />
      )}

      {/* Navigation is now rendered in the root layout */}

      <VisibilitySheet
        visible={isSheetVisible}
        onRequestClose={() => setSheetVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  searchContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  searchInput: {
    height: 44,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.45)',
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.text,
    fontSize: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 16,
    marginTop: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorDetail: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
  },
  warningText: {
    color: '#f59e0b',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  warningDetail: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  listEmpty: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  listEmptyTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  listEmptySubtitle: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
});

export default RadarScreen;

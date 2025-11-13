import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { logger } from '../src/utils/logger';
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
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { AppHeader } from '../src/components/AppHeader';
import { SocialProfileCard } from '../src/components/SocialProfileCard';
import VisibilitySheet from '../src/components/VisibilitySheet';
import { useVisibility } from '../src/contexts/VisibilityContext';
import { theme } from '../src/styles/theme';
import { getNearbyUsers, type NearbyUserData } from '../src/services';
import { supabase } from '../src/lib/supabase';

const SEARCH_DEBOUNCE_DELAY = 120;
const REALTIME_DEBOUNCE_DELAY = 500;

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
  const [hasNewUsers, setHasNewUsers] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const realtimeChannelRef = useRef<any>(null);
  const realtimeDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousUserIdsRef = useRef<Set<string>>(new Set());

  const loadNearbyUsers = useCallback(async (showSpinner = true) => {
    if (!isVisible || locationPermissionDenied) {
      setNearbyUsers([]);
      setLoading(false);
      setError(null);
      setHasNewUsers(false);
      return;
    }

    if (showSpinner) {
      setLoading(true);
    }
    setError(null);

    const { users, error: fetchError } = await getNearbyUsers();

    if (fetchError) {
      setError(fetchError.message);
      setNearbyUsers([]);
      setHasNewUsers(false);
    } else {
      const currentUserIds = new Set(users.map(u => u.id));
      const previousUserIds = previousUserIdsRef.current;

      const hasNew = users.some(u => !previousUserIds.has(u.id));
      if (hasNew && previousUserIds.size > 0) {
        setHasNewUsers(true);
      }

      previousUserIdsRef.current = currentUserIds;
      setNearbyUsers(users);
    }

    setLoading(false);
  }, [isVisible, locationPermissionDenied]);

  useEffect(() => {
    loadNearbyUsers(true);
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
    }, SEARCH_DEBOUNCE_DELAY);

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

  const handleTitlePress = useCallback(() => {
    loadNearbyUsers(true);
  }, [loadNearbyUsers]);

  const dismissNewUsersHint = useCallback(() => {
    setHasNewUsers(false);
  }, []);

  useEffect(() => {
    if (!isVisible || locationPermissionDenied) {
      if (realtimeChannelRef.current) {
        logger.debug('RT:Radar', 'Cleaning up realtime subscription (visibility off or permission denied)');
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
      if (realtimeDebounceTimerRef.current) {
        clearTimeout(realtimeDebounceTimerRef.current);
        realtimeDebounceTimerRef.current = null;
      }
      return;
    }

    logger.debug('RT:Radar', 'Setting up location realtime subscription');

    const handleLocationChange = () => {
      if (realtimeDebounceTimerRef.current) {
        clearTimeout(realtimeDebounceTimerRef.current);
      }

      realtimeDebounceTimerRef.current = setTimeout(() => {
        logger.debug('RT:Radar', 'Location change detected, refreshing nearby users silently');
        loadNearbyUsers(false);
      }, REALTIME_DEBOUNCE_DELAY);
    };

    realtimeChannelRef.current = supabase
      .channel('radar-location-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'locations',
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          logger.debug('RT:Radar', 'Location INSERT event received');
          handleLocationChange();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'locations',
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          logger.debug('RT:Radar', 'Location UPDATE event received');
          handleLocationChange();
        }
      )
      .subscribe((status: string) => {
        logger.info('RT:Radar', `Location channel status: ${status}`);
      });

    return () => {
      if (realtimeChannelRef.current) {
        logger.debug('RT:Radar', 'Cleaning up realtime subscription');
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
      if (realtimeDebounceTimerRef.current) {
        clearTimeout(realtimeDebounceTimerRef.current);
        realtimeDebounceTimerRef.current = null;
      }
    };
  }, [isVisible, locationPermissionDenied, loadNearbyUsers]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <AppHeader
        title="Radar"
        onTitlePress={handleTitlePress}
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

      {hasNewUsers && !isSearchOpen && isVisible && !locationPermissionDenied && !loading && !error ? (
        <View style={styles.newUsersHint}>
          <Text style={styles.newUsersText}>New people nearby</Text>
          <Text
            style={styles.dismissHint}
            onPress={dismissNewUsersHint}
            accessibilityLabel="Dismiss notification"
          >
            Dismiss
          </Text>
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
  newUsersHint: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  newUsersText: {
    color: '#60a5fa',
    fontSize: 14,
    fontWeight: '500',
  },
  dismissHint: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: '400',
    opacity: 0.8,
  },
});

export default RadarScreen;

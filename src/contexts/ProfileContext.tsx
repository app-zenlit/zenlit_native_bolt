import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Profile, SocialLinks } from '../lib/types';
import { getCurrentUserProfile } from '../services';

type ProfileContextValue = {
  profile: Profile | null;
  socialLinks: SocialLinks | null;
  isRefreshing: boolean;
  error: string | null;
  refresh: (force?: boolean) => Promise<void>;
  refreshKey: number;
};

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [socialLinks, setSocialLinks] = useState<SocialLinks | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const lastRefreshAtRef = useRef<number>(0);

  const refresh = useCallback(async (force: boolean = false) => {
    const now = Date.now();
    const MIN_INTERVAL_MS = 3000;
    if (!force && now - lastRefreshAtRef.current < MIN_INTERVAL_MS) {
      return;
    }

    setIsRefreshing(true);
    setError(null);
    try {
      const { profile: p, socialLinks: s, error: e } = await getCurrentUserProfile();
      if (e) {
        setError(e.message);
      }
      setProfile(p);
      setSocialLinks(s);
      lastRefreshAtRef.current = Date.now();
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      setError(typeof err?.message === 'string' ? err.message : 'Failed to load profile');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh(true);
  }, [refresh]);

  const value: ProfileContextValue = {
    profile,
    socialLinks,
    isRefreshing,
    error,
    refresh,
    refreshKey,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return ctx;
}


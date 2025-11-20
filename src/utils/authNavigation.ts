import { supabase } from '../lib/supabase';
import { logger } from './logger';

export const ROUTES = {
  landing: '/',
  auth: '/auth',
  onboardingBasic: '/onboarding/profile/basic',
  onboardingComplete: '/onboarding/profile/complete',
  home: '/radar',
} as const;

type ProfileRecord = {
  display_name?: string | null;
  user_name?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
} | null;

const hasBasicProfile = (profile: ProfileRecord) => Boolean(
  profile?.display_name &&
  profile?.user_name &&
  profile?.date_of_birth &&
  profile?.gender
);

const hasCompleteProfile = (profile: ProfileRecord) => Boolean(
  hasBasicProfile(profile) &&
  profile?.bio &&
  profile?.avatar_url
);

export const determinePostAuthRoute = async (options?: {
  userId?: string | null;
  profileOverride?: ProfileRecord;
}) => {
  try {
    let userId = options?.userId ?? null;

    if (!userId) {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        logger.error('AuthNavigation', 'Failed to fetch user for routing', error);
        return null;
      }
      userId = data.user?.id ?? null;
    }

    if (!userId) {
      logger.warn('AuthNavigation', 'No authenticated user available to determine route');
      return ROUTES.auth;
    }

    let profile: ProfileRecord | null | undefined = options?.profileOverride;
    if (typeof profile === 'undefined') {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, user_name, date_of_birth, gender, social_links(bio, profile_pic_url)')
        .eq('id', userId)
        .maybeSingle();
      if (error) {
        logger.error('AuthNavigation', 'Failed to load profile for routing', error);
      }
      // Flatten the social_links data
      profile = data ? {
        display_name: data.display_name,
        user_name: data.user_name,
        date_of_birth: data.date_of_birth,
        gender: data.gender,
        bio: (data.social_links as any)?.bio ?? null,
        avatar_url: (data.social_links as any)?.profile_pic_url ?? null,
      } : null;
    }

    if (!hasBasicProfile(profile)) {
      return ROUTES.onboardingBasic;
    }

    if (!hasCompleteProfile(profile)) {
      return ROUTES.onboardingComplete;
    }

    return ROUTES.home;
  } catch (error) {
    logger.error('AuthNavigation', 'Unknown routing failure', error);
    return ROUTES.home;
  }
};

export const getPostLogoutRoute = () => ROUTES.auth;

import { logger } from '../utils/logger'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'

const normalize = (val?: string): string | undefined => {
  if (typeof val !== 'string') return undefined
  const trimmed = val.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '')
  if (!trimmed) return undefined
  const lower = trimmed.toLowerCase()
  if (lower === 'undefined' || lower === 'null') return undefined
  return trimmed
}

const getSupabaseConfig = (): { url?: string; anonKey?: string; source: string } => {
  let url = normalize(process.env.EXPO_PUBLIC_SUPABASE_URL)
  let anonKey = normalize(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY)
  let source = 'process.env'

  if (!url || !anonKey) {
    url = normalize(Constants.expoConfig?.extra?.supabaseUrl)
    anonKey = normalize(Constants.expoConfig?.extra?.supabaseAnonKey)
    source = 'Constants.expoConfig.extra'
  }

  if (!url || !anonKey) {
    url = normalize((Constants as any).manifest?.extra?.supabaseUrl)
    anonKey = normalize((Constants as any).manifest?.extra?.supabaseAnonKey)
    source = 'Constants.manifest.extra'
  }

  return { url, anonKey, source };
};

const { url: envUrl, anonKey: envAnon, source: configSource } = getSupabaseConfig()

const isValidHttpUrl = (url?: string): boolean => {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

const isLikelySupabaseUrl = (url?: string): boolean => {
  if (!isValidHttpUrl(url)) return false
  try {
    const u = new URL(url as string)
    const host = u.host.toLowerCase()
    if (host.includes('supabase.co') || host.includes('supabase.com') || host.includes('supabase.in')) return true
    if (host.includes('localhost') || host.includes('127.0.0.1')) return true
    return false
  } catch {
    return false
  }
}

const hasValidConfig = isLikelySupabaseUrl(envUrl) && !!envAnon

const cryptoAvailable = typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function';
const urlAvailable = typeof URL !== 'undefined';

(() => {
  const meta = {
    configSource,
    url: envUrl ? `${envUrl.substring(0, 30)}...` : 'missing',
    anonKeyPrefix: envAnon ? `${envAnon.substring(0, 20)}...` : 'missing',
    parsedUrlOk: isValidHttpUrl(envUrl),
    looksLikeSupabaseUrl: isLikelySupabaseUrl(envUrl),
    cryptoAvailable,
    urlAvailable,
    ready: hasValidConfig,
  }
  logger.info('Supabase', 'Initialization config', meta)
})()

// Create client with defensive try/catch; fall back to safe stub if creation fails
let supabase: any
let supabaseReady = false

const makeStub = () => {
  logger.warn('Supabase', 'Not configured or failed to initialize. Running in stub mode without backend.')
  const unsupported = (method?: string) => {
    const err = new Error(`[Supabase] Not configured. ${method ? method + ' is unavailable in preview-safe mode.' : 'Backend unavailable.'}`)
    return Promise.reject(err)
  }

  const createQueryBuilder = () => {
    const builder: any = {
      select: (columns?: string) => {
        builder._select = columns;
        return builder;
      },
      insert: (data: any) => {
        builder._insert = data;
        return builder;
      },
      update: (data: any) => {
        builder._update = data;
        return builder;
      },
      delete: () => {
        builder._delete = true;
        return builder;
      },
      upsert: (data: any) => {
        builder._upsert = data;
        return builder;
      },
      eq: (column: string, value: any) => {
        builder._filters = builder._filters || [];
        builder._filters.push({ type: 'eq', column, value });
        return builder;
      },
      neq: (column: string, value: any) => {
        builder._filters = builder._filters || [];
        builder._filters.push({ type: 'neq', column, value });
        return builder;
      },
      gt: (column: string, value: any) => {
        builder._filters = builder._filters || [];
        builder._filters.push({ type: 'gt', column, value });
        return builder;
      },
      gte: (column: string, value: any) => {
        builder._filters = builder._filters || [];
        builder._filters.push({ type: 'gte', column, value });
        return builder;
      },
      lt: (column: string, value: any) => {
        builder._filters = builder._filters || [];
        builder._filters.push({ type: 'lt', column, value });
        return builder;
      },
      lte: (column: string, value: any) => {
        builder._filters = builder._filters || [];
        builder._filters.push({ type: 'lte', column, value });
        return builder;
      },
      in: (column: string, values: any[]) => {
        builder._filters = builder._filters || [];
        builder._filters.push({ type: 'in', column, values });
        return builder;
      },
      not: (column: string, operator: string, value: any) => {
        builder._filters = builder._filters || [];
        builder._filters.push({ type: 'not', column, operator, value });
        return builder;
      },
      or: (query: string) => {
        builder._filters = builder._filters || [];
        builder._filters.push({ type: 'or', query });
        return builder;
      },
      order: (column: string, options?: { ascending?: boolean }) => {
        builder._order = { column, ascending: options?.ascending ?? true };
        return builder;
      },
      limit: (count: number) => {
        builder._limit = count;
        return builder;
      },
      single: () => unsupported('query.single'),
      maybeSingle: () => unsupported('query.maybeSingle'),
      then: (resolve: any, reject: any) => {
        return unsupported('query.execute').then(resolve, reject);
      },
    };
    return builder;
  };

  return {
    auth: {
      getUser: () => unsupported('auth.getUser'),
      getSession: async () => ({ data: { session: null }, error: new Error('Not configured') } as any),
      signInWithOtp: () => unsupported('auth.signInWithOtp'),
      signOut: () => unsupported('auth.signOut'),
      onAuthStateChange: () => ({ data: { subscription: null } }),
    },
    from: (table: string) => createQueryBuilder(),
    rpc: (fn: string, params?: any) => unsupported(`rpc.${fn}`),
    storage: {
      from: (bucket: string) => ({
        upload: (path: string, file: any, options?: any) => unsupported('storage.upload'),
        getPublicUrl: (path: string) => ({ data: { publicUrl: '' }, error: null }),
        remove: (paths: string[]) => unsupported('storage.remove'),
      }),
    },
  } as any
}

if (hasValidConfig) {
  try {
    supabase = createClient(envUrl as string, envAnon as string, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
    supabaseReady = true
  } catch (err) {
    logger.error('Supabase', 'Failed to initialize client:', err)
    supabase = makeStub()
    supabaseReady = false
  }
} else {
  supabase = makeStub()
  supabaseReady = false
}

export { supabase, supabaseReady, getSupabaseConfig }

// Handle auth state changes only when real client exists
if (supabaseReady) {
  supabase.auth.onAuthStateChange(async (event: string, session: any) => {
    if (event === 'TOKEN_REFRESHED') {
      logger.info('Supabase', 'Token refreshed successfully')
    } else if (event === 'SIGNED_OUT') {
      logger.info('Supabase', 'User signed out, session cleared')
    }
  })
}

// Function to clear invalid session data
export const clearInvalidSession = async () => {
  try {
    if (supabaseReady) {
      const { data } = await supabase.auth.getSession()
      if (data?.session) {
        try {
          await supabase.auth.signOut({ scope: 'global' })
        } catch {}
      }
    }
    logger.info('Supabase', 'Invalid session cleared')
  } catch (error) {
    logger.error('Supabase', 'Error clearing session:', error)
  }
}

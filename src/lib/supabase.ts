import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Safely read environment values across web/native and guard against invalid strings
const readEnv = (key: string): string | undefined => {
  const val = (process.env as any)?.[key] ?? (globalThis as any)?.[key];
  if (typeof val !== 'string') return undefined;
  const trimmed = val.trim();
  if (!trimmed || trimmed.toLowerCase() === 'undefined' || trimmed.toLowerCase() === 'null') return undefined;
  return trimmed;
};

const envUrl = readEnv('EXPO_PUBLIC_SUPABASE_URL');
const envAnon = readEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');

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
  if (!isValidHttpUrl(url)) return false;
  try {
    const u = new URL(url as string);
    const host = u.host.toLowerCase();
    const port = u.port;
    const path = u.pathname.toLowerCase();

    // Official hosted projects
    if (host.includes('supabase.co') || host.includes('supabase.com') || host.includes('supabase.in')) {
      return true;
    }

    // Local dev: typically `http://127.0.0.1:54321` or endpoints prefixed with service paths
    const isLocalHost = host.includes('localhost') || host.includes('127.0.0.1');
    if (isLocalHost) {
      // Accept common local Supabase REST port or explicit service paths
      if (port === '54321') return true;
      if (path.startsWith('/rest') || path.startsWith('/auth') || path.startsWith('/storage') || path.startsWith('/functions')) {
        return true;
      }
      return false;
    }

    return false;
  } catch {
    return false;
  }
};

const hasValidConfig = isLikelySupabaseUrl(envUrl) && !!envAnon;

// Instrumentation to help diagnose environment issues in preview
(() => {
  const meta = {
    envUrl,
    envAnonPresent: !!envAnon,
    parsedUrlOk: isValidHttpUrl(envUrl),
    looksLikeSupabaseUrl: isLikelySupabaseUrl(envUrl),
    ready: hasValidConfig,
  };
  // Use console.info to avoid red error logs but provide visibility
  console.info('[Supabase Init]', meta);
})();

// Create client with defensive try/catch; fall back to safe stub if creation fails
let supabase: any;
let supabaseReady = false;

const makeStub = () => {
  console.warn('[Supabase] Not configured or failed to initialize. Running in preview-safe mode without backend.');
  const unsupported = (method?: string) => {
    const err = new Error(`[Supabase] Not configured. ${method ? method + ' is unavailable in preview-safe mode.' : 'Backend unavailable.'}`);
    return Promise.reject(err);
  };

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
  } as any;
};

if (hasValidConfig) {
  try {
    supabase = createClient(envUrl as string, envAnon as string, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    supabaseReady = true;
  } catch (err) {
    console.error('[Supabase] Failed to initialize client:', err);
    supabase = makeStub();
    supabaseReady = false;
  }
} else {
  supabase = makeStub();
  supabaseReady = false;
}

export { supabase, supabaseReady };

// Handle auth state changes only when real client exists
if (supabaseReady) {
  supabase.auth.onAuthStateChange(async (event: string, session: any) => {
    if (event === 'TOKEN_REFRESHED') {
      console.log('Token refreshed successfully');
    } else if (event === 'SIGNED_OUT') {
      // Clear any stored session data
      await AsyncStorage.removeItem('supabase.auth.token');
      console.log('User signed out, session cleared');
    }
  });
}

// Function to clear invalid session data
export const clearInvalidSession = async () => {
  try {
    await AsyncStorage.removeItem('supabase.auth.token');
    if (supabaseReady) {
      await supabase.auth.signOut();
    }
    console.log('Invalid session cleared');
  } catch (error) {
    console.error('Error clearing session:', error);
  }
};
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY.');
}

const localStorageAdapter = {
  getItem(key: string) {
    return window.localStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    window.localStorage.setItem(key, value);
  },
  removeItem(key: string) {
    window.localStorage.removeItem(key);
  }
};

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: localStorageAdapter
  }
});

export async function handleAuthRedirect(): Promise<void> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');

  if (!code) return;

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    throw error;
  }

  url.searchParams.delete('code');
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}

export async function getCurrentUserId(): Promise<string | null> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionData.session?.user.id) {
    return sessionData.session.user.id;
  }

  if (sessionError) {
    console.warn('Unable to get Supabase session', sessionError);
  }

  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.warn('Unable to get Supabase user', error);
    return null;
  }

  return data.user?.id ?? null;
}

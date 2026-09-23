import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, Profile, UserSettings, AppLanguage, UserRole, UserMode, UserReligion } from './supabase';
import { t as translate, isRTL } from './i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerPushDevice } from './push';
import { Platform } from 'react-native';
import { apiPublicPost } from './api';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  settings: UserSettings | null;
  loading: boolean;
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => Promise<void>;
  t: (key: string) => string;
  rtl: boolean;
  signUp: (phone: string, email: string, password: string, fullName: string, religion: UserReligion | null) => Promise<{ error: string | null, session?: Session | null }>;
  signIn: (identifier: string, password: string) => Promise<{ error: string | null }>;
  signInWithOAuth: (provider: 'google' | 'facebook') => Promise<{ error: string | null, url: string | null }>;
  resetPassword: (identifier: string) => Promise<{ error: string | null; recoveryEmail?: string | null; phone?: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
  updateRole: (role: UserRole) => Promise<{ error: string | null }>;
  updateMode: (mode: UserMode) => Promise<{ error: string | null }>;
  updateCountry: (country: string, currency: string) => Promise<{ error: string | null }>;
  updateProfile: (fields: Partial<Pick<Profile, 'full_name' | 'phone' | 'country' | 'currency' | 'avatar_url'>>) => Promise<{ error: string | null }>;
  updateSettings: (fields: Partial<Pick<UserSettings, 'notifications_enabled' | 'request_sound_enabled' | 'vibration_enabled' | 'location_enabled'>>) => Promise<{ error: string | null }>;
  deleteAccount: () => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getAuthRedirectUrl(path = ''): string {
  if (Platform.OS !== 'web') return `sharek://${path.replace(/^\//, '')}`;
  const configured = process.env.EXPO_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (configured) return `${configured}${path}`;
  if (typeof window !== 'undefined' && window.location?.origin) return `${window.location.origin}${path}`;
  return `sharek://${path.replace(/^\//, '')}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguageState] = useState<AppLanguage>('ar');

  useEffect(() => {
    (async () => {
      const savedLang = await AsyncStorage.getItem('sharek_lang');
      if (savedLang === 'ar' || savedLang === 'en') {
        setLanguageState(savedLang);
      }
    })();
  }, []);

  const loadProfile = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();

    if (error) {
      console.error('profile load error', error);
      return null;
    }
    if (data) {
      setProfile(data as Profile);
      setLanguageState(data.language as AppLanguage);
      await AsyncStorage.setItem('sharek_lang', data.language);
    }
    return data as Profile | null;
  }, []);

  const loadSettings = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();

    if (error) {
      console.error('settings load error', error);
      return null;
    }
    if (data) {
      setSettings(data as UserSettings);
      return data as UserSettings;
    }
    const { data: created, error: createErr } = await supabase
      .from('user_settings')
      .insert({ user_id: uid })
      .select()
      .single();
    if (createErr) {
      console.error('settings create error', createErr);
      return null;
    }
    setSettings(created as UserSettings);
    return created as UserSettings;
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) {
        Promise.all([
          loadProfile(data.session.user.id),
          loadSettings(data.session.user.id),
        ]).finally(() => mounted && setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      (async () => {
        setSession(newSession);
        if (newSession) {
          await Promise.all([
            loadProfile(newSession.user.id),
            loadSettings(newSession.user.id),
          ]);
          registerPushDevice().catch((error) => console.warn('push registration unavailable', error));
        } else {
          setProfile(null);
          setSettings(null);
        }
        setLoading(false);
      })();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile, loadSettings]);

  const setLanguage = useCallback(async (lang: AppLanguage) => {
    setLanguageState(lang);
    await AsyncStorage.setItem('sharek_lang', lang);
    if (session?.user) {
      const { error } = await supabase
        .from('profiles')
        .update({ language: lang })
        .eq('id', session.user.id);
      if (error) console.error('lang update error', error);
    }
  }, [session]);

  const normalizePhone = (value: string) => value.trim().replace(/[^\d+]/g, '');

  const signUp = useCallback(async (phone: string, email: string, password: string, fullName: string, religion: UserReligion | null) => {
    const savedLang = await AsyncStorage.getItem('sharek_lang');
    const lang: AppLanguage = savedLang === 'en' ? 'en' : 'ar';
    const normalizedPhone = normalizePhone(phone);
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: getAuthRedirectUrl('/'),
        data: {
          full_name: fullName,
          email: normalizedEmail,
          recovery_email: normalizedEmail,
          phone: normalizedPhone,
          language: lang,
          religion,
        },
      },
    });
    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes('already') || message.includes('registered')) return { error: 'accountAlreadyExists' };
      return { error: 'authError' };
    }
    if (data.user && data.session) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: fullName,
        email: normalizedEmail,
        phone: normalizedPhone,
        role: 'skipped',
        language: lang,
        religion: religion,
      });
      if (profileError && profileError.code !== '23505') console.error('profile insert error', profileError);
      await supabase.from('user_settings').insert({ user_id: data.user.id });
    }
    return { error: null, session: data.session };
  }, []);

  
  const signInWithOAuth = useCallback(async (provider: 'google' | 'facebook') => {
    const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: getAuthRedirectUrl('/') } });
    if (error) {
      if (error.message.toLowerCase().includes('unsupported provider')) {
        return { error: 'oauthProviderDisabled', url: null };
      }
      return { error: 'errorGeneric', url: null };
    }
    return { error: null, url: data.url };
  }, []);

  const signIn = useCallback(async (identifier: string, password: string) => {
    try {
      const { session: nextSession } = await apiPublicPost<{ session: Session }>('/auth/password-login', { identifier, password });
      const { error } = await supabase.auth.setSession({
        access_token: nextSession.access_token,
        refresh_token: nextSession.refresh_token,
      });
      if (error) return { error: 'invalidCredentials' };
    } catch {
      return { error: 'invalidCredentials' };
    }
    return { error: null };
  }, []);

  const resetPassword = useCallback(async (identifier: string) => {
    if (!identifier.trim()) return { error: 'loginIdentifierRequired' };
    try {
      const result = await apiPublicPost<{ ok: boolean; recoveryEmail: string | null; phone: string | null }>('/auth/recovery/start', { identifier });
      return { error: null, recoveryEmail: result.recoveryEmail, phone: result.phone };
    } catch {
      return { error: 'errorGeneric' };
    }
  }, []);

  const signOut = useCallback(async () => {
    // A local sign-out clears the persisted device session immediately. It must
    // not depend on a network round trip, otherwise a user can appear stuck in
    // their account while offline or when the auth service is unavailable.
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    setProfile(null);
    setSettings(null);
    setSession(null);
    return { error: error ? 'authError' : null };
  }, []);

  const updateRole = useCallback(async (role: UserRole) => {
    if (!session?.user) return { error: 'authError' };
    const { error } = await supabase.rpc('update_own_profile_role', { p_role: role });
    if (error) return { error: 'errorGeneric' };
    if (role === 'needer' || role === 'donor') {
      const { error: modeError } = await supabase.rpc('update_own_profile_mode', { p_mode: role });
      if (modeError) return { error: 'errorGeneric' };
    }
    await loadProfile(session.user.id);
    return { error: null };
  }, [session, loadProfile]);

  const updateMode = useCallback(async (mode: UserMode) => {
    if (!session?.user) return { error: 'authError' };
    const { error } = await supabase.rpc('update_own_profile_mode', { p_mode: mode });
    if (error) return { error: 'errorGeneric' };
    await loadProfile(session.user.id);
    return { error: null };
  }, [session, loadProfile]);

  const updateCountry = useCallback(async (country: string, currency: string) => {
    if (!session?.user) return { error: 'authError' };
    const { error } = await supabase.rpc('update_own_profile_country', {
      p_country: country,
      p_currency: currency,
    });
    if (error) return { error: 'errorGeneric' };
    await loadProfile(session.user.id);
    return { error: null };
  }, [session, loadProfile]);

  const updateProfile = useCallback(async (fields: Partial<Pick<Profile, 'full_name' | 'phone' | 'country' | 'currency' | 'avatar_url'>>) => {
    if (!session?.user) return { error: 'authError' };
    const { error } = await supabase
      .from('profiles')
      .update(fields)
      .eq('id', session.user.id);
    if (error) return { error: 'errorGeneric' };
    await loadProfile(session.user.id);
    return { error: null };
  }, [session, loadProfile]);

  const updateSettings = useCallback(async (fields: Partial<Pick<UserSettings, 'notifications_enabled' | 'request_sound_enabled' | 'vibration_enabled' | 'location_enabled'>>) => {
    if (!session?.user) return { error: 'authError' };
    const { error } = await supabase
      .from('user_settings')
      .update(fields)
      .eq('user_id', session.user.id);
    if (error) return { error: 'errorGeneric' };
    if (typeof fields.location_enabled === 'boolean') {
      await AsyncStorage.setItem('sharek_location_enabled', String(fields.location_enabled));
    }
    const { data } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (data) setSettings(data as UserSettings);
    return { error: null };
  }, [session]);

  const deleteAccount = useCallback(async () => {
    if (!session?.user) return { error: 'authError' };
    const { error } = await supabase.rpc('delete_own_account');
    if (error) return { error: 'errorGeneric' };
    await supabase.auth.signOut();
    setProfile(null);
    setSettings(null);
    setSession(null);
    return { error: null };
  }, [session]);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const value: AuthContextType = {
    session,
    user: session?.user ?? null,
    profile,
    settings,
    loading,
    language,
    setLanguage,
    t: (key: string) => translate(key, language),
    rtl: isRTL(language),
    signUp,
    signIn,
    signInWithOAuth,
    resetPassword,
    signOut,
    updateRole,
    updateMode,
    updateCountry,
    updateProfile,
    updateSettings,
    deleteAccount,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

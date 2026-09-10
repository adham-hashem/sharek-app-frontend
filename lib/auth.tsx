import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, Profile, UserSettings, AppLanguage, UserRole } from './supabase';
import { t as translate, isRTL } from './i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerPushDevice } from './push';

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
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateRole: (role: UserRole) => Promise<{ error: string | null }>;
  updateProfile: (fields: Partial<Pick<Profile, 'full_name' | 'phone' | 'country' | 'avatar_url'>>) => Promise<{ error: string | null }>;
  updateSettings: (fields: Partial<Pick<UserSettings, 'notifications_enabled' | 'request_sound_enabled' | 'vibration_enabled' | 'location_enabled'>>) => Promise<{ error: string | null }>;
  deleteAccount: () => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      if (error.message.includes('already')) return { error: 'emailInUse' };
      return { error: 'authError' };
    }
    if (data.user) {
      const savedLang = await AsyncStorage.getItem('sharek_lang');
      const lang: AppLanguage = savedLang === 'en' ? 'en' : 'ar';
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: fullName,
        email,
        role: 'skipped',
        language: lang,
      });
      if (profileError) console.error('profile insert error', profileError);
      await supabase.from('user_settings').insert({ user_id: data.user.id });
    }
    return { error: null };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: 'invalidCredentials' };
    }
    return { error: null };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!email.trim()) return { error: 'emailRequired' };
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: 'sharek://reset-password' });
    return { error: error ? 'errorGeneric' : null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSettings(null);
    setSession(null);
  }, []);

  const updateRole = useCallback(async (role: UserRole) => {
    if (!session?.user) return { error: 'authError' };
    const { error } = await supabase.rpc('update_own_profile_role', { p_role: role });
    if (error) return { error: 'errorGeneric' };
    await loadProfile(session.user.id);
    return { error: null };
  }, [session, loadProfile]);

  const updateProfile = useCallback(async (fields: Partial<Pick<Profile, 'full_name' | 'phone' | 'country' | 'avatar_url'>>) => {
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
    resetPassword,
    signOut,
    updateRole,
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

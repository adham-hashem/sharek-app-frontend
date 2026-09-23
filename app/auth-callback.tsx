import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, radius, spacing, typography } from '@/lib/theme';

export default function AuthCallbackScreen() {
  const { t, language, session } = useAuth();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const finish = async () => {
      if (typeof window === 'undefined') return;
      const current = new URL(window.location.href);
      const fragment = new URLSearchParams(current.hash.slice(1));
      const accessToken = fragment.get('access_token');
      const refreshToken = fragment.get('refresh_token');
      const code = current.searchParams.get('code');
      // Remove credentials from browser history before processing the session.
      window.history.replaceState({}, '', current.pathname);
      if (fragment.has('error') || current.searchParams.has('error')) {
        if (active) setFailed(true);
        return;
      }
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) { if (active) setFailed(true); }
        else router.replace('/');
        return;
      }
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) { if (active) setFailed(true); }
        else router.replace('/');
        return;
      }
      if (session) { router.replace('/'); return; }
      if (active) setFailed(true);
    };
    void finish();
    return () => { active = false; };
  }, [session]);

  return (
    <View style={styles.container}>
      {failed ? (
        <>
          <Text style={[styles.message, { fontFamily: language === 'ar' ? 'Cairo-Regular' : 'Inter-Regular' }]}>{t('authError')}</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.buttonText}>{t('login')}</Text>
          </TouchableOpacity>
        </>
      ) : <ActivityIndicator color={colors.primary} size="large" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, padding: spacing.lg },
  message: { ...typography.body, color: colors.brown, textAlign: 'center', marginBottom: spacing.md },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  buttonText: { ...typography.bodyBold, color: colors.white },
});

import { useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { colors, radius, spacing } from '@/lib/theme';

export function SocialSignIn({ onError }: { onError: (message: string) => void }) {
  const { signInWithOAuth, t, language } = useAuth();
  const [busy, setBusy] = useState<'google' | 'facebook' | null>(null);
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';
  const configured = {
    google: process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED === 'true',
    facebook: process.env.EXPO_PUBLIC_FACEBOOK_AUTH_ENABLED === 'true',
  };

  const signIn = async (provider: 'google' | 'facebook') => {
    setBusy(provider);
    onError('');
    const result = await signInWithOAuth(provider);
    setBusy(null);
    if (result.error) {
      onError(t(result.error));
      return;
    }
    if (Platform.OS !== 'web' && result.url) router.replace('/');
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.divider, { fontFamily: `${font}Regular` }]}>{t('orContinueWith')}</Text>
      <View style={styles.buttons}>
        {(['google', 'facebook'] as const).map(provider => (
          <TouchableOpacity key={provider} style={[styles.button, !configured[provider] && styles.pendingButton]} onPress={() => void signIn(provider)} disabled={busy !== null} accessibilityRole="button">
            {busy === provider ? <ActivityIndicator color={colors.primary} size="small" /> : (
              <>
                <Text style={[styles.brand, provider === 'facebook' && styles.facebookBrand]}>{provider === 'google' ? 'G' : 'f'}</Text>
                <Text style={[styles.label, { fontFamily: `${font}SemiBold` }]}>{t(provider)}</Text>
              </>
            )}
          </TouchableOpacity>
        ))}
      </View>
      {!configured.google && !configured.facebook && <Text style={[styles.pendingText, { fontFamily: `${font}Regular` }]}>{t('socialSignInPending')}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm, marginTop: spacing.sm },
  divider: { color: colors.brownMuted, textAlign: 'center', fontSize: 12 },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  button: { flex: 1, minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.white },
  brand: { fontSize: 22, fontWeight: '700', color: colors.primary },
  facebookBrand: { color: '#1877F2' },
  label: { fontSize: 13, color: colors.brown },
  pendingButton: { opacity: 0.55 },
  pendingText: { fontSize: 11, color: colors.brownMuted, textAlign: 'center' },
});

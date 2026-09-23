import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { router } from 'expo-router';
import { Lock, User } from 'lucide-react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SocialSignIn } from '@/components/SocialSignIn';

export default function LoginScreen() {
  const { signIn, t, language } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!identifier.trim() || password.length < 1) {
      setError(t('fillAllFields'));
      return;
    }
    setBusy(true);
    const { error: err } = await signIn(identifier.trim(), password);
    setBusy(false);
    if (err) {
      setError(t(err));
      return;
    }
    router.replace('/');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="" style={{ paddingHorizontal: 0, paddingTop: spacing.md, paddingBottom: spacing.sm }} />

        <View style={styles.logoFrame}>
          <Image source={require('../../assets/images/image copy.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.title}>{t('loginTitle')}</Text>
        <Text style={styles.sub}>{t('loginSub')}</Text>

        <View style={styles.form}>
          <View style={styles.inputWrap}>
            <User color={colors.brownMuted} size={20} />
            <TextInput
              style={styles.input}
              placeholder={language === 'ar' ? 'رقم الهاتف أو البريد الإلكتروني' : 'Phone number or email'}
              value={identifier}
              onChangeText={setIdentifier}
              placeholderTextColor={colors.brownMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputWrap}>
            <Lock color={colors.brownMuted} size={20} />
            <TextInput
              style={styles.input}
              placeholder={t('password')}
              value={password}
              onChangeText={setPassword}
              placeholderTextColor={colors.brownMuted}
              secureTextEntry
            />
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.button} onPress={submit} disabled={busy} activeOpacity={0.8}>
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{t('signIn')}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/forgot-password' as never)} disabled={busy} accessibilityRole="button">
            <Text style={styles.forgotText}>{t('forgotPassword')}</Text>
          </TouchableOpacity>

          <SocialSignIn onError={setError} />

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>{t('noAccount')} </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/register')}>
              <Text style={styles.switchLink}>{t('signUp')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl },

  logoFrame: {
    width: 72, height: 72, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt,
    justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: spacing.md,
    borderWidth: 2, borderColor: colors.borderLight,
    shadowColor: colors.shadowStrong, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 4,
  },
  logo: { width: 52, height: 52 },
  title: { ...typography.title, color: colors.brown, textAlign: 'center' },
  sub: { ...typography.caption, color: colors.brownMuted, textAlign: 'center', marginBottom: spacing.xl, marginTop: spacing.xs },
  form: { gap: spacing.md },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surfaceAlt, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  input: { ...typography.body, flex: 1, color: colors.brown, padding: 0 },
  errorBox: { backgroundColor: colors.errorBg, borderRadius: radius.sm, padding: spacing.sm },
  errorText: { ...typography.caption, color: colors.error, textAlign: 'center' },
  button: {
    backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: radius.md,
    alignItems: 'center', marginTop: spacing.sm,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  buttonText: { ...typography.bodyBold, color: colors.white },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md, gap: spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.small, color: colors.brownMuted },
  socialRow: { flexDirection: 'row', gap: spacing.md },
  socialBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, paddingVertical: spacing.md,
  },
  socialIcon: { ...typography.heading, fontWeight: '800' as const, color: colors.brown },
  socialText: { ...typography.body, color: colors.brown },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg },
  switchText: { ...typography.body, color: colors.brownMuted },
  switchLink: { ...typography.bodyBold, color: colors.primary },
  forgotText: { ...typography.caption, color: colors.primary, textAlign: 'center', marginTop: spacing.sm },
});

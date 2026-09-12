import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { router } from 'expo-router';
import { Mail, Lock, User, Moon, Church, Globe, Check, Scroll } from 'lucide-react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { UserReligion } from '@/lib/supabase';

const religionOptions: Array<{
  value: UserReligion;
  icon: React.ReactNode;
  labelKey: string;
  color: string;
  bg: string;
}> = [
  { value: 'muslim', icon: <Moon size={22} color={colors.green} />, labelKey: 'religionMuslim', color: colors.green, bg: colors.greenBg },
  { value: 'christian', icon: <Church size={22} color={colors.primary} />, labelKey: 'religionChristian', color: colors.primary, bg: colors.surfaceAlt },
  { value: 'jewish', icon: <Scroll size={22} color={colors.goldenDark} />, labelKey: 'religionJewish', color: colors.goldenDark, bg: colors.warningBg },
  { value: 'other', icon: <Globe size={22} color={colors.brownLight} />, labelKey: 'religionOther', color: colors.brownLight, bg: colors.surfaceMuted },
];

export default function RegisterScreen() {
  const { signUp, t } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [religion, setReligion] = useState<UserReligion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!fullName.trim()) return setError(t('fullNameRequired'));
    if (!email.trim()) return setError(t('emailRequired'));
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError(t('invalidEmail'));
    if (password.length < 6) return setError(t('passwordRequired'));
    if (!religion) return setError(t('religionRequired'));

    setBusy(true);
    const res = await signUp(email.trim(), password, fullName.trim(), religion);
    setBusy(false);
    if (res.error) {
      setError(t(res.error));
      return;
    }
    
    if (!res.session) {
      setError(t('emailConfirmationRequired') || 'Please check your email to confirm your account.');
      setTimeout(() => {
        router.replace('/(auth)/login');
      }, 3000);
      return;
    }

    router.replace('/(auth)/role');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="" style={{ paddingHorizontal: 0, paddingTop: spacing.md, paddingBottom: spacing.sm }} />

        <Image source={require('../../assets/images/image copy.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>{t('register')}</Text>
        <Text style={styles.sub}>{t('registerSub')}</Text>

        <View style={styles.form}>
          <View style={styles.inputWrap}>
            <User color={colors.brownMuted} size={20} />
            <TextInput
              style={styles.input}
              placeholder={t('fullName')}
              value={fullName}
              onChangeText={setFullName}
              placeholderTextColor={colors.brownMuted}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputWrap}>
            <Mail color={colors.brownMuted} size={20} />
            <TextInput
              style={styles.input}
              placeholder={t('email')}
              value={email}
              onChangeText={setEmail}
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

          <View style={styles.religionSection}>
            <Text style={styles.religionLabel}>{t('selectReligion')}</Text>
            <Text style={styles.religionSub}>{t('selectReligionSub')}</Text>
            <View style={styles.religionGrid}>
              {religionOptions.map(({ value, icon, labelKey, color, bg }) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.religionCard,
                    religion === value && { borderColor: color, borderWidth: 2.5 },
                  ]}
                  onPress={() => setReligion(value)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.religionIcon, { backgroundColor: bg }]}>
                    {icon}
                  </View>
                  <Text style={[styles.religionName, religion === value && { color }]}>
                    {t(labelKey)}
                  </Text>
                  {religion === value && (
                    <View style={[styles.religionCheck, { backgroundColor: color }]}>
                      <Check size={12} color={colors.white} strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.button} onPress={submit} disabled={busy} activeOpacity={0.8}>
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{t('createAccount')}</Text>}
          </TouchableOpacity>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>{t('haveAccount')} </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.switchLink}>{t('login')}</Text>
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

  logo: { width: 140, height: 140, alignSelf: 'center', marginBottom: spacing.md },
  title: { ...typography.title, color: colors.brown, textAlign: 'center' },
  sub: { ...typography.caption, color: colors.brownMuted, textAlign: 'center', marginBottom: spacing.xl, marginTop: spacing.xs },
  form: { gap: spacing.md },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surfaceAlt, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  input: { ...typography.body, flex: 1, color: colors.brown, padding: 0 },

  religionSection: {
    marginTop: spacing.xs,
  },
  religionLabel: {
    ...typography.bodyBold, color: colors.brown, marginBottom: 2,
  },
  religionSub: {
    ...typography.small, color: colors.brownMuted, marginBottom: spacing.sm,
  },
  religionGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
  },
  religionCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    position: 'relative',
  },
  religionIcon: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.xs,
  },
  religionName: {
    ...typography.bodyBold, color: colors.brown, textAlign: 'center',
  },
  religionCheck: {
    position: 'absolute', top: 8, right: 8,
    width: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },

  errorBox: { backgroundColor: colors.errorBg, borderRadius: radius.sm, padding: spacing.sm },
  errorText: { ...typography.caption, color: colors.error, textAlign: 'center' },
  button: {
    backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: radius.md,
    alignItems: 'center', marginTop: spacing.sm,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  buttonText: { ...typography.bodyBold, color: colors.white },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: spacing.md },
  switchText: { ...typography.body, color: colors.brownMuted },
  switchLink: { ...typography.bodyBold, color: colors.primary },
});

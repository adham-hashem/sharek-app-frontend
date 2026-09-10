import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, I18nManager } from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { router } from 'expo-router';
import { Globe } from 'lucide-react-native';
import { AppLanguage } from '@/lib/supabase';

export default function LanguageScreen() {
  const { setLanguage, t } = useAuth();
  const [selected, setSelected] = useState<AppLanguage>(I18nManager.isRTL ? 'ar' : 'ar');

  const choose = async (lang: AppLanguage) => {
    setSelected(lang);
    await setLanguage(lang);
    router.replace('/(auth)/register');
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoWrap}>
        <View style={styles.logoFrame}>
          <Image source={require('../../assets/images/image copy.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.appName}>{t('appName')}</Text>
        <Text style={styles.tagline}>{t('appTagline')}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.header}>
          <Globe color={colors.primary} size={28} />
          <Text style={styles.title}>{t('chooseLanguage')}</Text>
        </View>
        <Text style={styles.sub}>{t('chooseLanguageSub')}</Text>

        <TouchableOpacity
          style={[styles.option, selected === 'ar' && styles.optionActive]}
          onPress={() => choose('ar')}
          activeOpacity={0.7}
        >
          <Text style={styles.flag}>🇸🇦</Text>
          <Text style={[styles.optionText, selected === 'ar' && styles.optionTextActive]}>
            {t('arabic')}
          </Text>
          {selected === 'ar' && <View style={styles.dot} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.option, selected === 'en' && styles.optionActive]}
          onPress={() => choose('en')}
          activeOpacity={0.7}
        >
          <Text style={styles.flag}>🇬🇧</Text>
          <Text style={[styles.optionText, selected === 'en' && styles.optionTextActive]}>
            {t('english')}
          </Text>
          {selected === 'en' && <View style={styles.dot} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => choose(selected)}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>{t('continue')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  logoWrap: { alignItems: 'center', marginBottom: spacing.xl },
  logoFrame: {
    width: 88,
    height: 88,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.shadowStrong,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 2,
    borderColor: colors.borderLight,
  },
  logo: { width: 62, height: 62 },
  appName: { ...typography.huge, color: colors.brown },
  tagline: { ...typography.body, color: colors.brownMuted, marginTop: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  title: { ...typography.heading, color: colors.brown },
  sub: { ...typography.caption, color: colors.brownMuted, marginBottom: spacing.lg },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.surfaceAlt },
  flag: { fontSize: 24 },
  optionText: { ...typography.bodyBold, color: colors.brown, flex: 1 },
  optionTextActive: { color: colors.primary },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonText: { ...typography.bodyBold, color: colors.white },
});

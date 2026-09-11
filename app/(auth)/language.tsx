import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, I18nManager } from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { router } from 'expo-router';
import { Globe } from 'lucide-react-native';
import { AppLanguage } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ScreenHeader';

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
      <ScreenHeader title="" style={{ paddingHorizontal: 0, paddingTop: spacing.md, paddingBottom: spacing.sm }} />
      <View style={styles.logoWrap}>
        <Image source={require('../../assets/images/image copy.png')} style={styles.logo} resizeMode="contain" />
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
  },
  logoWrap: { alignItems: 'center', marginBottom: spacing.sm, marginTop: spacing.xs },
  logo: { width: 220, height: 220 },
  card: {
    paddingHorizontal: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  title: { ...typography.heading, color: colors.brown },
  sub: { ...typography.caption, color: colors.brownMuted, marginBottom: spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
    gap: spacing.md,
  },
  optionActive: { backgroundColor: 'rgba(255, 107, 53, 0.08)' },
  flag: { fontSize: 26 },
  optionText: { ...typography.bodyBold, color: colors.brown, flex: 1 },
  optionTextActive: { color: colors.primary },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonText: { ...typography.bodyBold, color: colors.white },
});

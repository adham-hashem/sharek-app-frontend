import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { router } from 'expo-router';
import { UserMode } from '@/lib/supabase';
import { Heart, HandHeart } from 'lucide-react-native';
import { ScreenHeader } from '@/components/ScreenHeader';

const modes: Array<{
  mode: UserMode;
  icon: React.ReactNode;
  color: string;
  bg: string;
}> = [
  { mode: 'needer', icon: <Heart size={32} color={colors.coral} />, color: colors.coral, bg: colors.errorBg },
  { mode: 'donor', icon: <HandHeart size={32} color={colors.green} />, color: colors.green, bg: colors.greenBg },
];

export default function ModeScreen() {
  const { updateMode, t, language } = useAuth();
  const [selected, setSelected] = useState<UserMode | null>(null);
  const [busy, setBusy] = useState(false);
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';

  const confirm = async () => {
    if (!selected) return;
    setBusy(true);
    await updateMode(selected);
    setBusy(false);
    router.replace('/(auth)/country');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <ScreenHeader title="" style={{ paddingHorizontal: 0, paddingTop: spacing.md, paddingBottom: spacing.sm }} />
      <View style={styles.logoFrame}>
        <Image source={require('../../assets/images/image copy.png')} style={styles.logo} resizeMode="contain" />
      </View>
      <Text style={[styles.title, { fontFamily: font + 'Bold' }]}>{t('selectMode')}</Text>
      <Text style={[styles.sub, { fontFamily: font + 'Regular' }]}>{t('selectModeSub')}</Text>

      <View style={styles.modesWrap}>
        {modes.map(({ mode, icon, color, bg }) => (
          <TouchableOpacity
            key={mode}
            style={[styles.modeCard, selected === mode && { borderColor: color, borderWidth: 2.5 }]}
            onPress={() => setSelected(mode)}
            activeOpacity={0.7}
          >
            <View style={[styles.modeIcon, { backgroundColor: bg }]}>{icon}</View>
            <Text style={[styles.modeName, selected === mode && { color }, { fontFamily: font + 'Bold' }]}>
              {t(`mode${mode.charAt(0).toUpperCase() + mode.slice(1)}`)}
            </Text>
            <Text style={[styles.modeDesc, { fontFamily: font + 'Regular' }]}>
              {t(`mode${mode.charAt(0).toUpperCase() + mode.slice(1)}Desc`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {selected && (
        <TouchableOpacity style={styles.confirmBtn} onPress={confirm} disabled={busy} activeOpacity={0.8}>
          {busy ? <ActivityIndicator color={colors.white} /> : (
            <Text style={[styles.confirmText, { fontFamily: font + 'Bold' }]}>{t('confirm')}</Text>
          )}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  logoFrame: {
    width: 72, height: 72, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt,
    justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: spacing.md,
    borderWidth: 2, borderColor: colors.borderLight,
    shadowColor: colors.shadowStrong, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 4,
  },
  logo: { width: 52, height: 52 },
  title: { ...typography.title, color: colors.brown, textAlign: 'center' },
  sub: { ...typography.caption, color: colors.brownMuted, textAlign: 'center', marginBottom: spacing.xl, marginTop: spacing.xs },
  modesWrap: { gap: spacing.md },
  modeCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    alignItems: 'center', borderWidth: 2, borderColor: colors.border,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  modeIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  modeName: { ...typography.bodyBold, color: colors.brown, textAlign: 'center' },
  modeDesc: { ...typography.small, color: colors.brownMuted, textAlign: 'center', marginTop: 2 },
  confirmBtn: {
    backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: radius.md,
    alignItems: 'center', marginTop: spacing.lg,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  confirmText: { ...typography.bodyBold, color: colors.white },
});

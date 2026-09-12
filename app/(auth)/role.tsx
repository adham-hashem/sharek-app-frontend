import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { router } from 'expo-router';
import { UserRole } from '@/lib/supabase';
import { Heart, HandHeart, Building2, Building, UtensilsCrossed, Hotel, SkipForward } from 'lucide-react-native';
import { ScreenHeader } from '@/components/ScreenHeader';

const roles: Array<{
  role: UserRole;
  icon: React.ReactNode;
  color: string;
  bg: string;
}> = [
  { role: 'needer', icon: <Heart size={32} color={colors.coral} />, color: colors.coral, bg: colors.errorBg },
  { role: 'donor', icon: <HandHeart size={32} color={colors.green} />, color: colors.green, bg: colors.greenBg },
  { role: 'charity', icon: <Building2 size={32} color={colors.primary} />, color: colors.primary, bg: colors.surfaceAlt },
  { role: 'organization', icon: <Building size={32} color={colors.brownLight} />, color: colors.brownLight, bg: colors.surfaceMuted },
  { role: 'restaurant', icon: <UtensilsCrossed size={32} color={colors.goldenDark} />, color: colors.goldenDark, bg: colors.warningBg },
  { role: 'hotel', icon: <Hotel size={32} color={colors.brownLight} />, color: colors.brownLight, bg: colors.surfaceMuted },
];

export default function RoleScreen() {
  const { updateRole, t, profile } = useAuth();
  const [selected, setSelected] = useState<UserRole | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    const role = selected ?? 'donor'; // skip defaults to donor now
    const { error } = await updateRole(role);
    setBusy(false);
    
    if (error) {
      alert(t('roleRequiresApproval') || 'This role requires administrator approval. Please contact support or choose a different role.');
      return;
    }

    const orgRoles: UserRole[] = ['charity', 'organization', 'restaurant', 'hotel'];
    if (orgRoles.includes(role)) {
      router.replace('/(auth)/mode' as never);
    } else {
      router.replace('/(auth)/country' as never);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <ScreenHeader title="" style={{ paddingHorizontal: 0, paddingTop: spacing.md, paddingBottom: spacing.sm }} />
      <View style={styles.logoFrame}>
        <Image source={require('../../assets/images/image copy.png')} style={styles.logo} resizeMode="contain" />
      </View>
      <Text style={styles.title}>{t('selectRole')}</Text>
      <Text style={styles.sub}>{t('selectRoleSub')}</Text>

      <View style={styles.grid}>
        {roles.map(({ role, icon, color, bg }) => (
          <TouchableOpacity
            key={role}
            style={[styles.roleCard, selected === role && { borderColor: color, borderWidth: 2.5 }]}
            onPress={() => setSelected(role)}
            activeOpacity={0.7}
          >
            <View style={[styles.roleIcon, { backgroundColor: bg }]}>{icon}</View>
            <Text style={[styles.roleName, selected === role && { color }]}>{t(`role${role.charAt(0).toUpperCase() + role.slice(1)}`)}</Text>
            <Text style={styles.roleDesc}>{t(`role${role.charAt(0).toUpperCase() + role.slice(1)}Desc`)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.skipBtn} onPress={confirm} disabled={busy} activeOpacity={0.8}>
        <SkipForward size={20} color={colors.brownMuted} />
        <Text style={styles.skipText}>{t('roleSkip')}</Text>
      </TouchableOpacity>

      {selected && (
        <TouchableOpacity style={styles.confirmBtn} onPress={confirm} disabled={busy} activeOpacity={0.8}>
          <Text style={styles.confirmText}>{t('confirm')}</Text>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  roleCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  roleIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  roleName: { ...typography.bodyBold, color: colors.brown, textAlign: 'center' },
  roleDesc: { ...typography.small, color: colors.brownMuted, textAlign: 'center', marginTop: 2 },
  skipBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: spacing.md, marginTop: spacing.lg,
  },
  skipText: { ...typography.bodyBold, color: colors.brownMuted },
  confirmBtn: {
    backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: radius.md,
    alignItems: 'center', marginTop: spacing.sm,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  confirmText: { ...typography.bodyBold, color: colors.white },
});

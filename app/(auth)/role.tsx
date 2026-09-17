import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { router } from 'expo-router';
import { supabase, UserMode, UserRole } from '@/lib/supabase';
import { Heart, HandHeart, Building2, Building, UtensilsCrossed, Hotel } from 'lucide-react-native';
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
  const { updateRole, t, profile, language } = useAuth();
  const [selected, setSelected] = useState<UserRole | null>(null);
  const [selectedMode, setSelectedMode] = useState<UserMode>('donor');
  const [pendingSent, setPendingSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const orgRoles: UserRole[] = ['charity', 'organization', 'restaurant', 'hotel'];
  const selectedNeedsApproval = selected ? orgRoles.includes(selected) : false;

  const confirm = async () => {
    if (!selected) return;
    setBusy(true);
    if (orgRoles.includes(selected)) {
      const { error } = await supabase.rpc('submit_role_approval_request', {
        p_role: selected,
        p_mode: selectedMode,
      });
      setBusy(false);
      if (error) {
        alert(t('errorGeneric'));
        return;
      }
      setPendingSent(true);
      return;
    }

    const { error } = await updateRole(selected);
    setBusy(false);
    
    if (error) {
      alert(t('roleRequiresApproval') || 'This role requires administrator approval. Please contact support or choose a different role.');
      return;
    }

    router.replace('/(auth)/country' as never);
  };

  if (pendingSent) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="" style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }} />
        <View style={styles.pendingWrap}>
          <View style={styles.pendingIcon}>
            <Building2 size={34} color={colors.primary} />
          </View>
          <Text style={styles.title}>
            {language === 'ar' ? 'تم إرسال طلب الدور' : 'Role request sent'}
          </Text>
          <Text style={styles.sub}>
            {language === 'ar'
              ? 'طلبك الآن في انتظار موافقة الأدمن. سيظهر للأدمن داخل لوحة الإدارة في قسم طلبات الأدوار.'
              : 'Your request is waiting for admin approval. Admins can review it from the Role Requests section.'}
          </Text>
          <TouchableOpacity style={styles.confirmBtn} onPress={() => router.replace('/(auth)/login')} activeOpacity={0.8}>
            <Text style={styles.confirmText}>{language === 'ar' ? 'العودة لتسجيل الدخول' : 'Back to login'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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

      {selectedNeedsApproval && (
        <View style={styles.approvalBox}>
          <Text style={styles.approvalTitle}>
            {language === 'ar' ? 'هذا الدور يحتاج موافقة الأدمن' : 'This role requires admin approval'}
          </Text>
          <Text style={styles.approvalDesc}>
            {language === 'ar'
              ? 'اختر هل سيعمل هذا الحساب كمحتاج أو كشريك/متبرع بعد الموافقة.'
              : 'Choose whether this account will operate as in-need or partner/donor after approval.'}
          </Text>
          <View style={styles.modeRow}>
            {(['needer', 'donor'] as UserMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.modeChip, selectedMode === mode && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => setSelectedMode(mode)}
                activeOpacity={0.8}
              >
                <Text style={[styles.modeChipText, selectedMode === mode && { color: colors.white }]}>
                  {t(`mode${mode.charAt(0).toUpperCase() + mode.slice(1)}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {selected && (
        <TouchableOpacity style={styles.confirmBtn} onPress={confirm} disabled={busy} activeOpacity={0.8}>
          {busy ? <ActivityIndicator color={colors.white} /> : (
            <Text style={styles.confirmText}>
              {selectedNeedsApproval
                ? (language === 'ar' ? 'إرسال طلب الموافقة' : 'Send approval request')
                : t('confirm')}
            </Text>
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
  pendingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  pendingIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
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
  approvalBox: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1.5, borderColor: colors.primary, marginTop: spacing.lg,
  },
  approvalTitle: { ...typography.bodyBold, color: colors.brown, textAlign: 'center' },
  approvalDesc: { ...typography.small, color: colors.brownMuted, textAlign: 'center', marginTop: spacing.xs },
  modeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  modeChip: {
    flex: 1, alignItems: 'center', borderRadius: radius.pill, paddingVertical: spacing.sm,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surfaceAlt,
  },
  modeChipText: { ...typography.small, color: colors.brown },
  confirmBtn: {
    backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: radius.md,
    alignItems: 'center', marginTop: spacing.sm,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  confirmText: { ...typography.bodyBold, color: colors.white },
});

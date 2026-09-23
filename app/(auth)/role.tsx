import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, Text, TouchableOpacity, ScrollView, Image, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { router } from 'expo-router';
import { UserMode, UserRole } from '@/lib/supabase';
import { Heart, HandHeart, Building2, Building, UtensilsCrossed, Hotel } from 'lucide-react-native';

const roles: Array<{
  role: UserRole;
  icon: React.ReactNode;
  color: string;
  bg: string;
}> = [
  { role: 'needer', icon: <Heart size={30} strokeWidth={1.8} color={colors.coral} />, color: colors.coral, bg: colors.errorBg },
  { role: 'donor', icon: <HandHeart size={30} strokeWidth={1.8} color={colors.green} />, color: colors.green, bg: colors.greenBg },
  { role: 'charity', icon: <Building2 size={30} strokeWidth={1.8} color={colors.primary} />, color: colors.primary, bg: colors.surfaceAlt },
  { role: 'organization', icon: <Building size={30} strokeWidth={1.8} color={colors.brownLight} />, color: colors.brownLight, bg: colors.surfaceMuted },
  { role: 'restaurant', icon: <UtensilsCrossed size={30} strokeWidth={1.8} color={colors.goldenDark} />, color: colors.goldenDark, bg: colors.warningBg },
  { role: 'hotel', icon: <Hotel size={30} strokeWidth={1.8} color={colors.brownLight} />, color: colors.brownLight, bg: colors.surfaceMuted },
];

export default function RoleScreen() {
  const { updateRole, updateMode, t, language } = useAuth();
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';
  const [selected, setSelected] = useState<UserRole | null>(null);
  const [selectedMode, setSelectedMode] = useState<UserMode>('donor');
  const [busy, setBusy] = useState(false);
  const orgRoles: UserRole[] = ['charity', 'organization', 'restaurant', 'hotel'];
  const selectedNeedsApproval = selected ? orgRoles.includes(selected) : false;

  useEffect(() => {
    const blockBack = () => true;
    const subscription = BackHandler.addEventListener('hardwareBackPress', blockBack);
    return () => subscription.remove();
  }, []);

  const confirm = async () => {
    if (!selected) return;
    setBusy(true);
    const { error } = await updateRole(selected);
    if (!error && selectedNeedsApproval) {
      const modeResult = await updateMode(selectedMode);
      if (modeResult.error) {
        setBusy(false);
        alert(t('errorGeneric'));
        return;
      }
    }
    setBusy(false);
    
    if (error) {
      alert(t('errorGeneric'));
      return;
    }

    router.replace('/(auth)/country' as never);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Image source={require('../../assets/images/image copy.png')} style={styles.logo} resizeMode="contain" />
      <Text style={[styles.title, { fontFamily: `${font}Bold` }]}>{t('selectRole')}</Text>
      <Text style={[styles.sub, { fontFamily: `${font}Regular` }]}>{t('selectRoleSub')}</Text>

      <View style={[styles.grid, { flexDirection: language === 'ar' ? 'row-reverse' : 'row' }]}>
        {roles.map(({ role, icon, bg }) => (
          <TouchableOpacity
            key={role}
            style={[styles.roleCard, selected === role && styles.roleCardSelected]}
            onPress={() => setSelected(role)}
            activeOpacity={0.7}
            accessibilityRole="radio"
            accessibilityState={{ selected: selected === role }}
          >
            <View style={[styles.roleIcon, { backgroundColor: bg }]}>{icon}</View>
            <Text style={[styles.roleName, { fontFamily: `${font}Bold` }, selected === role && styles.roleNameSelected]}>{t(`role${role.charAt(0).toUpperCase() + role.slice(1)}`)}</Text>
            <Text style={[styles.roleDesc, { fontFamily: `${font}Regular` }]}>{t(`role${role.charAt(0).toUpperCase() + role.slice(1)}Desc`)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedNeedsApproval && (
        <View style={styles.approvalBox}>
          <Text style={[styles.approvalTitle, { fontFamily: `${font}Bold` }]}>
            {language === 'ar' ? 'اختر طريقة استخدامك للتطبيق' : 'Choose how you will use SHARek'}
          </Text>
          <Text style={[styles.approvalDesc, { fontFamily: `${font}Regular` }]}>
            {language === 'ar'
              ? 'يمكنك البدء فورًا كمحتاج أو كشريك/متبرع، ولا تحتاج إلى انتظار موافقة.'
              : 'You can start immediately as a needer or partner/donor. No approval is required.'}
          </Text>
          <View style={[styles.modeRow, { flexDirection: language === 'ar' ? 'row-reverse' : 'row' }]}>
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
            <Text style={[styles.confirmText, { fontFamily: `${font}Bold` }]}>
              {language === 'ar' ? 'متابعة إلى التطبيق' : 'Continue to SHARek'}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.lg, flexGrow: 1 },
  logo: { width: 112, height: 73, alignSelf: 'center', marginBottom: spacing.sm },
  title: { fontSize: 22, lineHeight: 34, color: colors.brown, textAlign: 'center' },
  sub: { ...typography.caption, color: colors.brownMuted, textAlign: 'center', marginBottom: spacing.md, marginTop: 2 },
  grid: { flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  roleCard: {
    width: '48.5%', minHeight: 126,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingVertical: 10, paddingHorizontal: spacing.sm,
    alignItems: 'center',
    borderWidth: 1, borderColor: colors.borderLight,
  },
  roleCardSelected: { borderColor: colors.primary, backgroundColor: colors.surfaceAlt },
  roleIcon: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
  roleName: { fontSize: 14, lineHeight: 22, color: colors.brown, textAlign: 'center' },
  roleNameSelected: { color: colors.primaryDark },
  roleDesc: { fontSize: 11, lineHeight: 17, color: colors.brownMuted, textAlign: 'center', marginTop: 1 },
  approvalBox: {
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.borderLight, marginTop: spacing.md,
  },
  approvalTitle: { ...typography.bodyBold, color: colors.brown, textAlign: 'center' },
  approvalDesc: { ...typography.small, color: colors.brownMuted, textAlign: 'center', marginTop: spacing.xs },
  modeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  modeChip: {
    flex: 1, alignItems: 'center', borderRadius: radius.md, paddingVertical: spacing.sm,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white,
  },
  modeChipText: { ...typography.small, color: colors.brown },
  confirmBtn: {
    backgroundColor: colors.primary, minHeight: 48, justifyContent: 'center', borderRadius: radius.md,
    alignItems: 'center', marginTop: spacing.md,
  },
  confirmText: { ...typography.bodyBold, color: colors.white },
});

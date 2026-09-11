import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView, Image,
  Alert, Modal, ActivityIndicator, TextInput,
} from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { supabase, UserRole } from '@/lib/supabase';
import { router } from 'expo-router';
import { ContributorBadges } from '@/components/ContributorBadges';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import {
  User, Edit3, Shield, Settings as SettingsIcon, LogOut,
  ChevronLeft, X, Heart, HandHeart, Building2, UtensilsCrossed, Hotel, Check, Star, Phone, Mail, MapPin,
  MessageCircle, History,
} from 'lucide-react-native';

const roleConfig: Array<{ role: UserRole; icon: React.ReactNode; labelKey: string; color: string }> = [
  { role: 'needer', icon: <Heart size={22} color={colors.coral} />, labelKey: 'modeNeeder', color: colors.coral },
  { role: 'donor', icon: <HandHeart size={22} color={colors.green} />, labelKey: 'modeDonor', color: colors.green },
  { role: 'charity', icon: <Building2 size={22} color={colors.primary} />, labelKey: 'roleCharity', color: colors.primary },
  { role: 'restaurant', icon: <UtensilsCrossed size={22} color={colors.goldenDark} />, labelKey: 'roleRestaurant', color: colors.goldenDark },
  { role: 'hotel', icon: <Hotel size={22} color={colors.brownLight} />, labelKey: 'roleHotel', color: colors.brownLight },
];

export default function MenuScreen() {
  const { profile, t, language, rtl, signOut, updateRole, updateProfile, user } = useAuth();
  const [roleModal, setRoleModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [unread, setUnread] = useState(0);
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';
  const isAdmin = user?.app_metadata?.is_admin === true || user?.app_metadata?.role === 'admin';

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .is('read_at', null);
      setUnread(count ?? 0);
    };
    fetchUnread();
    const sub = supabase
      .channel('unread_msgs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchUnread)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [user]);

  const pickRole = async (role: UserRole) => {
    setBusy(true);
    const { error } = await updateRole(role);
    setBusy(false);
    if (error) { Alert.alert(t('errorGeneric')); return; }
    setRoleModal(false);
  };

  const openEditProfile = () => {
    setEditName(profile?.full_name ?? '');
    setEditPhone(profile?.phone ?? '');
    setEditCountry(profile?.country ?? '');
    setEditModal(true);
  };

  const saveProfile = async () => {
    setBusy(true);
    const { error } = await updateProfile({
      full_name: editName.trim() || undefined,
      phone: editPhone.trim(),
      country: editCountry.trim(),
    });
    setBusy(false);
    if (error) { Alert.alert(t('errorGeneric')); return; }
    setEditModal(false);
    Alert.alert(t('profileUpdated'));
  };

  const confirmSignOut = () => {
    Alert.alert(
      t('signOut'),
      t('signOut') + '?',
      [
        { text: t('back'), style: 'cancel' },
        { text: t('signOut'), style: 'destructive', onPress: () => signOut() },
      ]
    );
  };

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 0; i < 5; i++) {
      stars.push(
        <Star key={i} size={14} color={i < Math.round(rating) ? colors.golden : colors.border} fill={i < Math.round(rating) ? colors.golden : 'none'} />
      );
    }
    return <View style={{ flexDirection: 'row', gap: 2 }}>{stars}</View>;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return language === 'ar'
      ? `${d.getMonth() + 1}/${d.getFullYear()}`
      : `${d.toLocaleString('en', { month: 'short' })} ${d.getFullYear()}`;
  };

  const MenuItem = ({
    icon, label, onPress, color, bg, showChevron, destructive, badge,
  }: {
    icon: React.ReactNode;
    label: string;
    onPress: () => void;
    color: string;
    bg: string;
    showChevron?: boolean;
    destructive?: boolean;
    badge?: number;
  }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIcon, { backgroundColor: bg }]}>{icon}</View>
      <Text style={[typography.body, { color: destructive ? colors.error : colors.brown, flex: 1, fontFamily: `${font}Regular` }]}>
        {label}
      </Text>
      {badge !== undefined && badge > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={[typography.micro, { color: colors.white, fontFamily: `${font}Bold` }]}>{badge}</Text>
        </View>
      )}
      {showChevron && <ChevronLeft size={20} color={colors.brownMuted} style={{ transform: rtl ? [{ scaleX: -1 }] : [] }} />}
    </TouchableOpacity>
  );

  const currentRole = roleConfig.find(r => r.role === profile?.role);
  const isVerified = Boolean((profile as unknown as { is_verified?: boolean } | null)?.is_verified);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <View style={styles.headerBg}>
        <Image source={require('../../assets/images/image copy.png')} style={styles.headerLogo} resizeMode="contain" />
        <View style={styles.nameRow}>
          <Text style={[typography.heading, { color: colors.brown, fontFamily: `${font}Bold` }]} numberOfLines={1}>
            {profile?.full_name ?? 'SHARek'}
          </Text>
          {isVerified && <VerifiedBadge language={language} size={18} />}
        </View>
        <Text style={[typography.caption, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
          {profile?.email}
        </Text>
        {currentRole && (
          <View style={styles.roleBadge}>
            {currentRole.icon}
            <Text style={[typography.small, { color: currentRole.color, fontFamily: `${font}SemiBold` }]}>
              {t(currentRole.labelKey)}
            </Text>
          </View>
        )}
        {profile && profile.rating > 0 && (
          <View style={styles.ratingRow}>
            {renderStars(profile.rating)}
            <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
              {profile.rating.toFixed(1)}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <HandHeart size={20} color={colors.green} />
          <Text style={[typography.huge, { color: colors.brown, fontSize: 22, fontFamily: `${font}ExtraBold` }]}>
            {profile?.meals_helped ?? 0}
          </Text>
          <Text style={[typography.small, { color: colors.brownMuted, textAlign: 'center', fontFamily: `${font}Regular` }]}>
            {t('mealsHelped')}
          </Text>
        </View>
        <View style={styles.statCard}>
          <UtensilsCrossed size={20} color={colors.coral} />
          <Text style={[typography.huge, { color: colors.brown, fontSize: 22, fontFamily: `${font}ExtraBold` }]}>
            {profile?.meals_received ?? 0}
          </Text>
          <Text style={[typography.small, { color: colors.brownMuted, textAlign: 'center', fontFamily: `${font}Regular` }]}>
            {t('mealsReceived')}
          </Text>
        </View>
      </View>

      {profile && (
        <ContributorBadges profile={profile} t={t} font={font} />
      )}

      <View style={styles.menuSection}>
        <Text style={[typography.small, { color: colors.brownMuted, marginBottom: spacing.sm, fontFamily: `${font}SemiBold` }]}>
          {t('menu')}
        </Text>

        <MenuItem
          icon={<User size={20} color={colors.primary} />}
          label={t('personalAccount')}
          onPress={openEditProfile}
          color={colors.primary}
          bg={colors.surfaceAlt}
          showChevron
        />
        <MenuItem
          icon={<History size={20} color={colors.green} />}
          label={t('history')}
          onPress={() => router.push('/history' as never)}
          color={colors.green}
          bg={colors.greenBg}
          showChevron
        />
        <MenuItem
          icon={<MessageCircle size={20} color={colors.coral} />}
          label={t('chatTitle')}
          onPress={() => router.push('/conversations')}
          color={colors.coral}
          bg={colors.errorBg}
          showChevron
          badge={unread}
        />
        <MenuItem
          icon={<Edit3 size={20} color={colors.goldenDark} />}
          label={t('editProfile')}
          onPress={openEditProfile}
          color={colors.goldenDark}
          bg={colors.warningBg}
          showChevron
        />
        <MenuItem
          icon={currentRole?.icon ?? <Shield size={20} color={colors.green} />}
          label={t('userMode')}
          onPress={() => setRoleModal(true)}
          color={colors.green}
          bg={colors.greenBg}
          showChevron
        />
        <MenuItem
          icon={<SettingsIcon size={20} color={colors.brownLight} />}
          label={t('settings')}
          onPress={() => router.push('/settings')}
          color={colors.brownLight}
          bg={colors.surfaceMuted}
          showChevron
        />
        {isAdmin && (
          <MenuItem
            icon={<Shield size={20} color={colors.primary} />}
            label={t('adminPricing')}
            onPress={() => router.push('/admin' as never)}
            color={colors.primary}
            bg={colors.surfaceAlt}
            showChevron
          />
        )}
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={confirmSignOut} activeOpacity={0.7}>
        <LogOut size={20} color={colors.error} />
        <Text style={[typography.bodyBold, { color: colors.error, fontFamily: `${font}Bold` }]}>
          {t('signOut')}
        </Text>
      </TouchableOpacity>

      {profile && (
        <Text style={[typography.small, { color: colors.brownMuted, textAlign: 'center', marginTop: spacing.lg, fontFamily: `${font}Regular` }]}>
          {t('memberSince')} {formatDate(profile.created_at)}
        </Text>
      )}

      <Modal visible={roleModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={[typography.heading, { color: colors.brown, fontFamily: `${font}Bold` }]}>
                {t('selectRole')}
              </Text>
              <TouchableOpacity onPress={() => setRoleModal(false)}>
                <X size={22} color={colors.brownMuted} />
              </TouchableOpacity>
            </View>
            <Text style={[typography.caption, { color: colors.brownMuted, marginBottom: spacing.md, fontFamily: `${font}Regular` }]}>
              {t('selectRoleSub')}
            </Text>
            <View style={styles.roleList}>
              {roleConfig.map(({ role, icon, labelKey, color }) => (
                <TouchableOpacity
                  key={role}
                  style={[styles.roleOption, profile?.role === role && { borderColor: color, borderWidth: 2 }]}
                  onPress={() => pickRole(role)}
                  disabled={busy}
                >
                  {icon}
                  <Text style={[typography.body, { color: colors.brown, flex: 1, fontFamily: `${font}Regular` }]}>
                    {t(labelKey)}
                  </Text>
                  {profile?.role === role && <Check size={20} color={color} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={editModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={[typography.heading, { color: colors.brown, fontFamily: `${font}Bold` }]}>
                {t('editProfile')}
              </Text>
              <TouchableOpacity onPress={() => setEditModal(false)}>
                <X size={22} color={colors.brownMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[typography.small, { color: colors.brownMuted, marginBottom: 4, fontFamily: `${font}Regular` }]}>
              {t('editName')}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholderTextColor={colors.brownMuted}
            />

            <Text style={[typography.small, { color: colors.brownMuted, marginBottom: 4, fontFamily: `${font}Regular` }]}>
              {t('editPhone')}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholderTextColor={colors.brownMuted}
              keyboardType="phone-pad"
            />

            <Text style={[typography.small, { color: colors.brownMuted, marginBottom: 4, fontFamily: `${font}Regular` }]}>
              {t('editCountry')}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={editCountry}
              onChangeText={setEditCountry}
              placeholderTextColor={colors.brownMuted}
            />

            <TouchableOpacity style={styles.modalSaveBtn} onPress={saveProfile} disabled={busy} activeOpacity={0.8}>
              {busy ? <ActivityIndicator color={colors.white} /> : (
                <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>{t('save')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerBg: {
    backgroundColor: colors.surfaceAlt,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    alignItems: 'center',
  },
  headerLogo: { width: 72, height: 72 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.sm,
    maxWidth: '100%',
  },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.white, borderRadius: radius.pill,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs, marginTop: spacing.sm,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 1,
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  statsRow: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  statCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', gap: spacing.xs,
    borderWidth: 1.5, borderColor: colors.border,
  },
  menuSection: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.sm,
    marginHorizontal: spacing.lg, marginTop: spacing.lg, borderWidth: 1.5, borderColor: colors.border,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.md, paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight,
  },
  menuIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.errorBg, borderRadius: radius.md, paddingVertical: spacing.md,
    marginHorizontal: spacing.lg, marginTop: spacing.lg,
  },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  unreadBadge: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.coral,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5, marginRight: spacing.xs,
  },
  modalCard: {
    backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.lg, paddingBottom: spacing.xxl,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalInput: {
    ...typography.body, color: colors.brown,
    backgroundColor: colors.surfaceAlt, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  modalSaveBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md,
    alignItems: 'center', marginTop: spacing.sm,
  },
  roleList: { gap: spacing.sm },
  roleOption: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    borderWidth: 1.5, borderColor: colors.border,
  },
});

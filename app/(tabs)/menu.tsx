import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView, Image,
  Alert, Modal, ActivityIndicator, TextInput, Platform, Pressable,
} from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { supabase, UserRole, UserMode } from '@/lib/supabase';
import { router } from 'expo-router';
import { ContributorBadges } from '@/components/ContributorBadges';
import { AchievementBadgeDisplay, AchievementProgress, AllBadgesRow } from '@/components/AchievementBadge';
import {
  User, Edit3, Shield, Settings as SettingsIcon, LogOut,
  ChevronLeft, X, Heart, HandHeart, Building2, Building, UtensilsCrossed, Hotel, Check, Star,
  MessageCircle, History, BadgeCheck, ShieldCheck, Book, Menu as MenuIcon, Award,
} from 'lucide-react-native';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { SafeAreaView } from 'react-native-safe-area-context';

const roleConfig: Array<{ role: UserRole; icon: React.ReactNode; labelKey: string; color: string }> = [
  { role: 'needer', icon: <Heart size={22} color={colors.coral} />, labelKey: 'modeNeeder', color: colors.coral },
  { role: 'donor', icon: <HandHeart size={22} color={colors.green} />, labelKey: 'modeDonor', color: colors.green },
  { role: 'charity', icon: <Building2 size={22} color={colors.primary} />, labelKey: 'roleCharity', color: colors.primary },
  { role: 'organization', icon: <Building size={22} color={colors.brownLight} />, labelKey: 'roleOrganization', color: colors.brownLight },
  { role: 'restaurant', icon: <UtensilsCrossed size={22} color={colors.goldenDark} />, labelKey: 'roleRestaurant', color: colors.goldenDark },
  { role: 'hotel', icon: <Hotel size={22} color={colors.brownLight} />, labelKey: 'roleHotel', color: colors.brownLight },
];

const ORG_ROLES: UserRole[] = ['charity', 'organization', 'restaurant', 'hotel'];

const modeConfig: Array<{ mode: UserMode; icon: React.ReactNode; labelKey: string; color: string }> = [
  { mode: 'needer', icon: <Heart size={22} color={colors.coral} />, labelKey: 'modeNeeder', color: colors.coral },
  { mode: 'donor', icon: <HandHeart size={22} color={colors.green} />, labelKey: 'modeDonor', color: colors.green },
];

export default function MenuScreen() {
  const { profile, t, language, rtl, signOut, updateRole, updateMode, updateProfile, user } = useAuth();
  const [roleModal, setRoleModal] = useState(false);
  const [modeModal, setModeModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [unread, setUnread] = useState(0);
  const [donorStats, setDonorStats] = useState({ donated_meals: 0, people_helped: 0 });
  const profileScrollRef = useRef<ScrollView>(null);
  const achievementY = useRef(0);
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';
  const donorMode = profile?.role === 'donor' || profile?.mode === 'donor';

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

  useEffect(() => {
    if (!user || !donorMode) return;
    supabase.from('donor_statistics').select('donated_meals,people_helped').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setDonorStats({ donated_meals: Number(data.donated_meals ?? 0), people_helped: Number(data.people_helped ?? 0) }); });
  }, [user, donorMode]);

  const pickRole = async (role: UserRole) => {
    setBusy(true);
    const { error } = await updateRole(role);
    setBusy(false);
    if (error) { Alert.alert(t('errorGeneric')); return; }
    setRoleModal(false);
    if (ORG_ROLES.includes(role) && !profile?.mode) {
      setModeModal(true);
    }
  };

  const pickMode = async (mode: UserMode) => {
    setBusy(true);
    const { error } = await updateMode(mode);
    setBusy(false);
    if (error) { Alert.alert(t('errorGeneric')); return; }
    setModeModal(false);
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

  const performSignOut = async () => {
    setBusy(true);
    await signOut();
    setBusy(false);
    router.dismissAll();
    router.replace('/(auth)/welcome');
  };

  const confirmSignOut = () => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || window.confirm(t('signOut') + '?')) void performSignOut();
      return;
    }
    Alert.alert(
      t('signOut'),
      t('signOut') + '?',
      [
        { text: t('back'), style: 'cancel' },
        {
          text: t('signOut'),
          style: 'destructive',
          onPress: () => { void performSignOut(); },
        },
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
    icon, label, onPress, bg, showChevron, destructive, badge,
  }: {
    icon: React.ReactNode;
    label: string;
    onPress: () => void;
    color?: string;
    bg: string;
    showChevron?: boolean;
    destructive?: boolean;
    badge?: number;
  }) => (
    <TouchableOpacity style={[styles.menuItem, { flexDirection: rtl ? 'row-reverse' : 'row' }]} onPress={() => { setDrawerOpen(false); onPress(); }} activeOpacity={0.7}>
      <View style={[styles.menuIcon, { backgroundColor: bg }]}>{icon}</View>
      <Text style={[typography.body, { color: destructive ? colors.error : colors.brown, flex: 1, fontFamily: `${font}Regular`, textAlign: rtl ? 'right' : 'left' }]}>
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
  const isOrgRole = profile && ORG_ROLES.includes(profile.role);
  const currentMode = isOrgRole ? modeConfig.find(m => m.mode === profile?.mode) : null;

  const DrawerHeading = ({ title }: { title: string }) => (
    <Text style={[styles.drawerHeading, { fontFamily: `${font}Bold`, textAlign: rtl ? 'right' : 'left' }]}>{title}</Text>
  );

  return (
    <ScrollView ref={profileScrollRef} style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl + 88 }}>
      <View style={styles.headerBg}>
        <View style={[styles.profileToolbar, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity style={styles.hamburgerButton} onPress={() => setDrawerOpen(true)} accessibilityRole="button" accessibilityLabel={t('menu')}>
            <MenuIcon size={22} color={colors.brown} />
            {unread > 0 && <View style={styles.hamburgerDot} />}
          </TouchableOpacity>
          <Text style={[styles.profileToolbarTitle, { fontFamily: `${font}Bold` }]}>{t('profile')}</Text>
          <View style={styles.toolbarSpacer} />
        </View>
        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.profileAvatar} />
        ) : (
          <View style={[styles.profileAvatar, styles.profileAvatarPlaceholder]}>
            <Text style={[styles.profileInitial, { fontFamily: `${font}Bold` }]}>{profile?.full_name?.charAt(0)?.toUpperCase() ?? 'S'}</Text>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm }}>
          <Text style={[typography.heading, { color: colors.brown, fontFamily: `${font}Bold` }]}>
            {profile?.full_name ?? 'SHARek'}
          </Text>
          {profile?.is_verified && <VerifiedBadge language={language} size={18} />}
          {profile && (profile.contributor_level ?? 0) > 0 && (
            <AchievementBadgeDisplay level={profile.contributor_level ?? 0} language={language} t={t} size={16} />
          )}
        </View>
        <Text style={[typography.caption, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
          {profile?.email}
        </Text>
        <Text style={[styles.verificationText, { fontFamily: `${font}SemiBold`, color: profile?.is_verified ? colors.greenDark : colors.brownMuted }]}>
          {profile?.is_verified ? t('verifiedAccount') : t('getVerified')}
        </Text>
        {currentRole && (
          <View style={styles.roleBadge}>
            {currentRole.icon}
            <Text style={[typography.small, { color: currentRole.color, fontFamily: `${font}SemiBold` }]}>
              {t(currentRole.labelKey)}
            </Text>
          </View>
        )}
        {profile && (
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
            {donorMode ? donorStats.donated_meals : (profile?.meals_helped ?? 0)}
          </Text>
          <Text style={[typography.small, { color: colors.brownMuted, textAlign: 'center', fontFamily: `${font}Regular` }]}>
            {donorMode ? t('totalDonatedMeals') : t('mealsHelped')}
          </Text>
        </View>
        <View style={styles.statCard}>
          <UtensilsCrossed size={20} color={colors.coral} />
          <Text style={[typography.huge, { color: colors.brown, fontSize: 22, fontFamily: `${font}ExtraBold` }]}>
            {donorMode ? donorStats.people_helped : (profile?.meals_received ?? 0)}
          </Text>
          <Text style={[typography.small, { color: colors.brownMuted, textAlign: 'center', fontFamily: `${font}Regular` }]}>
            {donorMode ? t('peopleHelped') : t('mealsReceived')}
          </Text>
        </View>
      </View>

      {profile && (
        <ContributorBadges profile={profile} t={t} font={font} />
      )}

      {profile && (
        <View style={styles.achievementCard} onLayout={event => { achievementY.current = event.nativeEvent.layout.y; }}>
          <Text style={[typography.small, { color: colors.brownMuted, marginBottom: spacing.sm, fontFamily: `${font}SemiBold` }]}>
            {t('achievementProgress')}
          </Text>
          <AchievementProgress
            level={profile.contributor_level ?? 0}
            completedShares={profile.meals_helped ?? 0}
            language={language}
            t={t}
          />
          <View style={{ marginTop: spacing.md }}>
            <AllBadgesRow level={profile.contributor_level ?? 0} language={language} t={t} />
          </View>
        </View>
      )}

      <View style={[styles.profileActions, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
        <TouchableOpacity style={styles.profileAction} onPress={() => router.push(donorMode ? '/(tabs)/donate' : '/(tabs)/request')}>
          <UtensilsCrossed size={18} color={colors.green} />
          <Text style={[styles.profileActionText, { fontFamily: `${font}SemiBold` }]}>{t(donorMode ? 'donate' : 'request')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.profileAction} onPress={() => router.push('/history' as never)}>
          <History size={18} color={colors.primary} />
          <Text style={[styles.profileActionText, { fontFamily: `${font}SemiBold` }]}>{t('history')}</Text>
        </TouchableOpacity>
      </View>

      {profile && (
        <Text style={[typography.small, { color: colors.brownMuted, textAlign: 'center', marginTop: spacing.lg, fontFamily: `${font}Regular` }]}>
          {t('memberSince')} {formatDate(profile.created_at)}
        </Text>
      )}

      <Modal visible={drawerOpen} transparent animationType="fade" onRequestClose={() => setDrawerOpen(false)}>
        <View style={styles.drawerOverlay}>
          <Pressable style={styles.drawerBackdrop} onPress={() => setDrawerOpen(false)} accessibilityLabel={t('back')} />
          <SafeAreaView style={[styles.drawerPanel, rtl ? { right: 0 } : { left: 0 }]} edges={['top', 'bottom']}>
            <View style={[styles.drawerTop, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
              <Text style={[styles.drawerTitle, { fontFamily: `${font}Bold` }]}>{t('menu')}</Text>
              <TouchableOpacity onPress={() => setDrawerOpen(false)} style={styles.drawerClose} accessibilityRole="button" accessibilityLabel={t('back')}>
                <X size={21} color={colors.brown} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.drawerScroll}>
      <View style={styles.menuSection}>
        <DrawerHeading title={language === 'ar' ? 'الحساب' : 'Account'} />

        <MenuItem
          icon={<User size={20} color={colors.primary} />}
          label={t('profile')}
          onPress={() => profileScrollRef.current?.scrollTo({ y: 0, animated: true })}
          bg={colors.surfaceAlt}
          showChevron
        />
        <MenuItem
          icon={<Edit3 size={20} color={colors.goldenDark} />}
          label={t('editProfile')}
          onPress={() => setTimeout(openEditProfile, 250)}
          color={colors.goldenDark}
          bg={colors.warningBg}
          showChevron
        />
        <MenuItem
          icon={<BadgeCheck size={20} color="#1DA1F2" />}
          label={profile?.is_verified ? t('verifiedAccount') : t('getVerified')}
          onPress={() => router.push('/verify-account' as never)}
          color="#1DA1F2"
          bg="rgba(29, 161, 242, 0.1)"
          showChevron
        />
        <DrawerHeading title={language === 'ar' ? 'النشاط' : 'Activity'} />
        <MenuItem
          icon={<History size={20} color={colors.green} />}
          label={t('history')}
          onPress={() => router.push('/history' as never)}
          color={colors.green}
          bg={colors.greenBg}
          showChevron
        />
        <MenuItem
          icon={<UtensilsCrossed size={20} color={colors.green} />}
          label={t(donorMode ? 'donate' : 'request')}
          onPress={() => router.push(donorMode ? '/(tabs)/donate' : '/(tabs)/request')}
          bg={colors.greenBg}
          showChevron
        />
        <MenuItem
          icon={<Award size={20} color={colors.goldenDark} />}
          label={t('badgesTitle')}
          onPress={() => profileScrollRef.current?.scrollTo({ y: achievementY.current, animated: true })}
          bg={colors.warningBg}
          showChevron
        />
        <DrawerHeading title={language === 'ar' ? 'التواصل' : 'Communication'} />
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
          icon={<Heart size={20} color={colors.goldenDark} />}
          label={t('supportSharekHeart')}
          onPress={() => router.push('/support' as never)}
          color={colors.goldenDark}
          bg={colors.warningBg}
          showChevron
        />
        <DrawerHeading title={language === 'ar' ? 'الإعدادات' : 'Settings'} />
        <MenuItem
          icon={currentRole?.icon ?? <Shield size={20} color={colors.green} />}
          label={t('userMode')}
          onPress={() => setTimeout(() => setRoleModal(true), 250)}
          color={colors.green}
          bg={colors.greenBg}
          showChevron
        />
        {isOrgRole && (
          <MenuItem
            icon={currentMode?.icon ?? <Heart size={20} color={colors.coral} />}
            label={t('selectMode')}
            onPress={() => setTimeout(() => setModeModal(true), 250)}
            color={colors.coral}
            bg={colors.errorBg}
            showChevron
          />
        )}
        {profile?.religion === 'muslim' && (
          <MenuItem
            icon={<Book size={20} color={colors.green} />}
            label={t('quranMushaf')}
            onPress={() => router.push('/quran' as never)}
            color={colors.green}
            bg={colors.greenBg}
            showChevron
          />
        )}
        <MenuItem
          icon={<SettingsIcon size={20} color={colors.brownLight} />}
          label={t('settings')}
          onPress={() => router.push('/settings')}
          color={colors.brownLight}
          bg={colors.surfaceMuted}
          showChevron
        />
        <MenuItem
          icon={<Shield size={20} color={colors.coral} />}
          label={language === 'ar' ? 'الإبلاغ عن مشكلة' : 'Report a problem'}
          onPress={() => router.push('/report-problem' as never)}
          color={colors.coral}
          bg={colors.errorBg}
          showChevron
        />
        {profile?.is_admin && (
          <MenuItem
            icon={<ShieldCheck size={20} color={colors.primary} />}
            label={language === 'ar' ? 'لوحة الإدارة' : 'Admin Dashboard'}
            onPress={() => router.push('/admin-dashboard' as never)}
            color={colors.primary}
            bg={colors.surfaceAlt}
            showChevron
          />
        )}
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={confirmSignOut} disabled={busy} activeOpacity={0.7}>
        {busy ? <ActivityIndicator size={20} color={colors.error} /> : <LogOut size={20} color={colors.error} />}
        <Text style={[typography.bodyBold, { color: colors.error, fontFamily: `${font}Bold` }]}>
          {t('signOut')}
        </Text>
      </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

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

      <Modal visible={modeModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={[typography.heading, { color: colors.brown, fontFamily: `${font}Bold` }]}>
                {t('selectMode')}
              </Text>
              <TouchableOpacity onPress={() => setModeModal(false)}>
                <X size={22} color={colors.brownMuted} />
              </TouchableOpacity>
            </View>
            <Text style={[typography.caption, { color: colors.brownMuted, marginBottom: spacing.md, fontFamily: `${font}Regular` }]}>
              {t('selectModeSub')}
            </Text>
            <View style={styles.roleList}>
              {modeConfig.map(({ mode, icon, labelKey, color }) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.roleOption, profile?.mode === mode && { borderColor: color, borderWidth: 2 }]}
                  onPress={() => pickMode(mode)}
                  disabled={busy}
                >
                  {icon}
                  <Text style={[typography.body, { color: colors.brown, flex: 1, fontFamily: `${font}Regular` }]}>
                    {t(labelKey)}
                  </Text>
                  {profile?.mode === mode && <Check size={20} color={color} />}
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
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    alignItems: 'center',
  },
  profileToolbar: { width: '100%', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  profileToolbarTitle: { fontSize: 17, color: colors.brown },
  hamburgerButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  hamburgerDot: { position: 'absolute', top: 7, right: 6, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.coral },
  toolbarSpacer: { width: 42 },
  profileAvatar: { width: 86, height: 86, borderRadius: 43 },
  profileAvatarPlaceholder: { backgroundColor: colors.greenBg, alignItems: 'center', justifyContent: 'center' },
  profileInitial: { fontSize: 32, color: colors.greenDark },
  verificationText: { fontSize: 11, marginTop: 3 },
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
    backgroundColor: colors.white,
  },
  menuItem: {
    alignItems: 'center', gap: spacing.sm,
    minHeight: 54, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight,
  },
  menuIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  profileActions: { gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.md },
  profileAction: { flex: 1, minHeight: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: spacing.xs },
  profileActionText: { color: colors.brown, fontSize: 12, textAlign: 'center' },
  drawerOverlay: { flex: 1, backgroundColor: colors.overlay },
  drawerBackdrop: { flex: 1 },
  drawerPanel: { position: 'absolute', top: 0, bottom: 0, width: '84%', maxWidth: 360, backgroundColor: colors.white },
  drawerTop: { alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  drawerTitle: { color: colors.brown, fontSize: 19 },
  drawerClose: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  drawerScroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  drawerHeading: { color: colors.brownMuted, fontSize: 12, marginTop: spacing.lg, marginBottom: spacing.xs, paddingHorizontal: spacing.sm },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.errorBg, borderRadius: radius.md, minHeight: 52, paddingVertical: spacing.md,
    marginTop: spacing.lg,
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
  achievementCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    marginHorizontal: spacing.lg, marginTop: spacing.lg, borderWidth: 1.5, borderColor: colors.border,
  },
  roleList: { gap: spacing.sm },
  roleOption: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    borderWidth: 1.5, borderColor: colors.border,
  },
});

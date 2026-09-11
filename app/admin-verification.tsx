import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl, Modal, TextInput, Alert,
} from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { supabase, VerificationRequest, VerificationFee } from '@/lib/supabase';
import { COUNTRIES } from '@/lib/countries';
import { router } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import {
  CheckCircle2, Clock, XCircle, ShieldCheck, DollarSign,
  Users, TrendingUp, Edit3, X, Save, ChevronLeft,
} from 'lucide-react-native';

type Tab = 'pending' | 'approved' | 'rejected' | 'fees' | 'stats';

interface AdminVerificationRequest extends VerificationRequest {
  profile_name?: string;
  profile_email?: string;
  profile_role?: string;
}

export default function AdminVerificationScreen() {
  const { t, language, rtl, profile } = useAuth();
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';

  const [tab, setTab] = useState<Tab>('pending');
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<AdminVerificationRequest[]>([]);
  const [fees, setFees] = useState<VerificationFee[]>([]);
  const [stats, setStats] = useState<{ pending: number; approved: number; rejected: number; suspended: number; total_revenue: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actionModal, setActionModal] = useState<AdminVerificationRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'suspend' | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [feeModal, setFeeModal] = useState<VerificationFee | null>(null);
  const [feeAmount, setFeeAmount] = useState('');
  const [feeCurrency, setFeeCurrency] = useState('USD');

  const isAdmin = profile?.is_admin === true;

  const loadAll = useCallback(async () => {
    const [reqResult, feeResult, statsResult] = await Promise.all([
      supabase.from('verification_requests').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('verification_fees').select('*').order('country_code', { ascending: true }),
      supabase.rpc('get_verification_stats'),
    ]);

    if (reqResult.data) {
      const reqs = reqResult.data as VerificationRequest[];
      const userIds = [...new Set(reqs.map(r => r.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .in('id', userIds);
      const profileMap = new Map((profilesData ?? []).map((p: any) => [p.id, p]));
      setRequests(reqs.map(r => ({
        ...r,
        profile_name: profileMap.get(r.user_id)?.full_name ?? 'Unknown',
        profile_email: profileMap.get(r.user_id)?.email ?? '',
        profile_role: profileMap.get(r.user_id)?.role ?? '',
      })));
    }
    if (feeResult.data) setFees(feeResult.data as VerificationFee[]);
    if (statsResult.data) setStats(statsResult.data as any);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    loadAll();
    const sub = supabase
      .channel('admin_verification')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'verification_requests' }, loadAll)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [isAdmin, loadAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const handleAction = async () => {
    if (!actionModal || !actionType) return;
    setBusy(true);
    try {
      if (actionType === 'approve') {
        const { error } = await supabase.rpc('approve_verification', { p_request_id: actionModal.id });
        if (error) Alert.alert(t('errorGeneric'));
      } else if (actionType === 'reject') {
        const { error } = await supabase.rpc('reject_verification', { p_request_id: actionModal.id, p_notes: notes });
        if (error) Alert.alert(t('errorGeneric'));
      } else if (actionType === 'suspend') {
        const { error } = await supabase.rpc('suspend_verification', { p_request_id: actionModal.id, p_notes: notes });
        if (error) Alert.alert(t('errorGeneric'));
      }
      setActionModal(null);
      setActionType(null);
      setNotes('');
      await loadAll();
    } catch {
      Alert.alert(t('errorGeneric'));
    }
    setBusy(false);
  };

  const handleSaveFee = async () => {
    if (!feeModal) return;
    const amt = parseFloat(feeAmount);
    if (isNaN(amt) || amt < 0) { Alert.alert(t('errorGeneric')); return; }
    setBusy(true);
    const { error } = await supabase.rpc('update_verification_fee', {
      p_country_code: feeModal.country_code,
      p_currency: feeCurrency,
      p_amount: amt,
    });
    if (error) { Alert.alert(t('errorGeneric')); }
    else {
      setFeeModal(null);
      setFeeAmount('');
      await loadAll();
    }
    setBusy(false);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return language === 'ar'
      ? `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
      : d.toLocaleDateString('en', { dateStyle: 'medium' });
  };

  const statusColors: Record<string, { color: string; bg: string }> = {
    pending: { color: colors.goldenDark, bg: colors.warningBg },
    under_review: { color: colors.goldenDark, bg: colors.warningBg },
    approved: { color: '#1DA1F2', bg: 'rgba(29, 161, 242, 0.1)' },
    rejected: { color: colors.error, bg: colors.errorBg },
    suspended: { color: colors.brownMuted, bg: colors.surfaceMuted },
  };

  const filteredRequests = requests.filter(r => {
    if (tab === 'pending') return r.status === 'pending' || r.status === 'under_review';
    if (tab === 'approved') return r.status === 'approved';
    if (tab === 'rejected') return r.status === 'rejected' || r.status === 'suspended';
    return false;
  });

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t('adminVerification')} />
        <View style={styles.accessDenied}>
          <ShieldCheck size={48} color={colors.brownMuted} />
          <Text style={[typography.body, { color: colors.brownMuted, marginTop: spacing.md, fontFamily: `${font}Regular` }]}>
            {t('errorGeneric')}
          </Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t('adminVerification')} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  const tabs: Array<{ key: Tab; label: string; count?: number }> = [
    { key: 'pending', label: t('pendingRequests'), count: stats?.pending },
    { key: 'approved', label: t('verifiedAccounts'), count: stats?.approved },
    { key: 'rejected', label: t('rejectedRequests'), count: (stats?.rejected ?? 0) + (stats?.suspended ?? 0) },
    { key: 'fees', label: t('verificationFees') },
    { key: 'stats', label: t('revenueStats') },
  ];

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('adminVerification')} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Stats overview */}
        <View style={styles.statsGrid}>
          <View style={styles.statMini}>
            <Clock size={18} color={colors.goldenDark} />
            <Text style={[typography.huge, { fontSize: 22, color: colors.brown, fontFamily: `${font}ExtraBold` }]}>
              {stats?.pending ?? 0}
            </Text>
            <Text style={[typography.micro, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
              {t('pendingRequests')}
            </Text>
          </View>
          <View style={styles.statMini}>
            <CheckCircle2 size={18} color="#1DA1F2" />
            <Text style={[typography.huge, { fontSize: 22, color: colors.brown, fontFamily: `${font}ExtraBold` }]}>
              {stats?.approved ?? 0}
            </Text>
            <Text style={[typography.micro, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
              {t('verifiedAccounts')}
            </Text>
          </View>
          <View style={styles.statMini}>
            <DollarSign size={18} color={colors.green} />
            <Text style={[typography.huge, { fontSize: 22, color: colors.brown, fontFamily: `${font}ExtraBold` }]}>
              {(stats?.total_revenue ?? 0).toFixed(0)}
            </Text>
            <Text style={[typography.micro, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
              {t('totalRevenue')}
            </Text>
          </View>
        </View>

        {/* Tab bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
          {tabs.map(tb => (
            <TouchableOpacity
              key={tb.key}
              style={[styles.tab, tab === tb.key && styles.tabActive]}
              onPress={() => setTab(tb.key)}
              activeOpacity={0.7}
            >
              <Text style={[
                typography.small,
                {
                  color: tab === tb.key ? colors.primary : colors.brownMuted,
                  fontFamily: `${font}${tab === tb.key ? 'Bold' : 'Regular'}`,
                },
              ]}>
                {tb.label}
                {tb.count !== undefined && tb.count > 0 ? ` (${tb.count})` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Tab content */}
        {tab === 'fees' ? (
          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            {fees.map(f => {
              const country = COUNTRIES.find(c => c.code === f.country_code);
              return (
                <View key={f.id} style={styles.feeRowCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}SemiBold` }]}>
                      {country?.flag ?? ''} {country ? (language === 'ar' ? country.nameAr : country.nameEn) : f.country_code}
                    </Text>
                    <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                      {f.amount.toFixed(2)} {f.currency}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.editFeeBtn}
                    onPress={() => { setFeeModal(f); setFeeAmount(String(f.amount)); setFeeCurrency(f.currency); }}
                    activeOpacity={0.7}
                  >
                    <Edit3 size={16} color={colors.primary} />
                    <Text style={[typography.small, { color: colors.primary, fontFamily: `${font}Bold` }]}>
                      {t('editFee')}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ) : tab === 'stats' ? (
          <View style={{ gap: spacing.md, marginTop: spacing.md }}>
            <View style={styles.revenueCard}>
              <View style={styles.revenueIconWrap}>
                <TrendingUp size={28} color={colors.green} />
              </View>
              <Text style={[typography.title, { color: colors.brown, fontFamily: `${font}Bold` }]}>
                {t('totalRevenue')}
              </Text>
              <Text style={[typography.huge, { fontSize: 36, color: colors.green, fontFamily: `${font}ExtraBold` }]}>
                {(stats?.total_revenue ?? 0).toFixed(2)}
              </Text>
              <Text style={[typography.caption, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                {t('verificationRevenue')}
              </Text>
            </View>
            <View style={styles.breakdownCard}>
              <View style={styles.breakdownRow}>
                <Clock size={18} color={colors.goldenDark} />
                <Text style={[typography.body, { color: colors.brown, flex: 1, fontFamily: `${font}Regular` }]}>
                  {t('pendingRequests')}
                </Text>
                <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]}>
                  {stats?.pending ?? 0}
                </Text>
              </View>
              <View style={styles.breakdownRow}>
                <CheckCircle2 size={18} color="#1DA1F2" />
                <Text style={[typography.body, { color: colors.brown, flex: 1, fontFamily: `${font}Regular` }]}>
                  {t('verifiedAccounts')}
                </Text>
                <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]}>
                  {stats?.approved ?? 0}
                </Text>
              </View>
              <View style={styles.breakdownRow}>
                <XCircle size={18} color={colors.error} />
                <Text style={[typography.body, { color: colors.brown, flex: 1, fontFamily: `${font}Regular` }]}>
                  {t('rejectedRequests')}
                </Text>
                <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]}>
                  {stats?.rejected ?? 0}
                </Text>
              </View>
              <View style={styles.breakdownRow}>
                <Users size={18} color={colors.brownMuted} />
                <Text style={[typography.body, { color: colors.brown, flex: 1, fontFamily: `${font}Regular` }]}>
                  {t('suspendedAccounts')}
                </Text>
                <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]}>
                  {stats?.suspended ?? 0}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            {filteredRequests.length === 0 ? (
              <View style={styles.emptyState}>
                <ShieldCheck size={40} color={colors.brownMuted} />
                <Text style={[typography.body, { color: colors.brownMuted, marginTop: spacing.md, fontFamily: `${font}Regular` }]}>
                  {t('noVerificationRequests')}
                </Text>
              </View>
            ) : (
              filteredRequests.map(req => {
                const sc = statusColors[req.status] ?? statusColors.pending;
                return (
                  <View key={req.id} style={styles.reqCard}>
                    <View style={styles.reqCardHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.reqNameRow}>
                          <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}SemiBold` }]}>
                            {req.profile_name}
                          </Text>
                          {req.status === 'approved' && <VerifiedBadge language={language} size={14} />}
                        </View>
                        <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                          {req.profile_email}
                        </Text>
                      </View>
                      <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
                        <Text style={[typography.micro, { color: sc.color, fontFamily: `${font}Bold` }]}>
                          {t(`verificationStatus${req.status.charAt(0).toUpperCase()}${req.status.slice(1)}`.replace('under_review', 'Pending').replace('Pending', 'Pending'))}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.reqCardDetails}>
                      <View style={styles.reqDetailRow}>
                        <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                          {t('verificationFee')}
                        </Text>
                        <Text style={[typography.small, { color: colors.brown, fontFamily: `${font}SemiBold` }]}>
                          {req.fee_amount.toFixed(2)} {req.fee_currency}
                        </Text>
                      </View>
                      <View style={styles.reqDetailRow}>
                        <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                          {t('supportDate')}
                        </Text>
                        <Text style={[typography.small, { color: colors.brown, fontFamily: `${font}Regular` }]}>
                          {formatDate(req.created_at)}
                        </Text>
                      </View>
                      <View style={styles.reqDetailRow}>
                        <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                          {language === 'ar' ? 'الدفع' : 'Payment'}
                        </Text>
                        <Text style={[typography.small, {
                          color: req.payment_status === 'paid' ? colors.green : colors.goldenDark,
                          fontFamily: `${font}SemiBold`,
                        }]}>
                          {req.payment_status === 'paid' ? (language === 'ar' ? 'مدفوع' : 'Paid') : (language === 'ar' ? 'غير مدفوع' : 'Unpaid')}
                        </Text>
                      </View>
                      {req.admin_notes ? (
                        <View style={styles.notesDisplay}>
                          <Text style={[typography.micro, { color: colors.brownMuted, fontFamily: `${font}SemiBold` }]}>
                            {t('adminNotes')}
                          </Text>
                          <Text style={[typography.small, { color: colors.brownLight, fontFamily: `${font}Regular` }]}>
                            {req.admin_notes}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {tab === 'pending' && req.payment_status === 'paid' && (
                      <View style={styles.reqActions}>
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: '#1DA1F2' }]}
                          onPress={() => { setActionModal(req); setActionType('approve'); setNotes(''); }}
                          activeOpacity={0.7}
                        >
                          <CheckCircle2 size={16} color={colors.white} />
                          <Text style={[typography.small, { color: colors.white, fontFamily: `${font}Bold` }]}>
                            {t('approve')}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: colors.errorBg, borderWidth: 1, borderColor: colors.error }]}
                          onPress={() => { setActionModal(req); setActionType('reject'); setNotes(''); }}
                          activeOpacity={0.7}
                        >
                          <XCircle size={16} color={colors.error} />
                          <Text style={[typography.small, { color: colors.error, fontFamily: `${font}Bold` }]}>
                            {t('reject')}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {tab === 'approved' && (
                      <View style={styles.reqActions}>
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.brownMuted }]}
                          onPress={() => { setActionModal(req); setActionType('suspend'); setNotes(''); }}
                          activeOpacity={0.7}
                        >
                          <XCircle size={16} color={colors.brownMuted} />
                          <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Bold` }]}>
                            {t('suspend')}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {tab === 'rejected' && req.status === 'rejected' && (
                      <View style={styles.reqActions}>
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: '#1DA1F2' }]}
                          onPress={() => { setActionModal(req); setActionType('approve'); setNotes(''); }}
                          activeOpacity={0.7}
                        >
                          <CheckCircle2 size={16} color={colors.white} />
                          <Text style={[typography.small, { color: colors.white, fontFamily: `${font}Bold` }]}>
                            {t('approve')}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* Action Modal */}
      <Modal visible={actionModal !== null} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={[typography.heading, { color: colors.brown, fontFamily: `${font}Bold` }]}>
                {actionType === 'approve' ? t('approve') : actionType === 'reject' ? t('reject') : t('suspend')}
              </Text>
              <TouchableOpacity onPress={() => { setActionModal(null); setActionType(null); }}>
                <X size={22} color={colors.brownMuted} />
              </TouchableOpacity>
            </View>
            {actionModal && (
              <Text style={[typography.body, { color: colors.brownMuted, marginBottom: spacing.md, fontFamily: `${font}Regular` }]}>
                {actionModal.profile_name}
              </Text>
            )}
            <Text style={[typography.small, { color: colors.brownMuted, marginBottom: 4, fontFamily: `${font}Regular` }]}>
              {t('enterAdminNotes')}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={notes}
              onChangeText={setNotes}
              placeholderTextColor={colors.brownMuted}
              multiline
              numberOfLines={3}
            />
            <TouchableOpacity
              style={[styles.modalActionBtn, { backgroundColor: actionType === 'approve' ? '#1DA1F2' : actionType === 'reject' ? colors.error : colors.brownMuted }]}
              onPress={handleAction}
              disabled={busy}
              activeOpacity={0.8}
            >
              {busy ? <ActivityIndicator color={colors.white} /> : (
                <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>
                  {actionType === 'approve' ? t('approve') : actionType === 'reject' ? t('reject') : t('suspend')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Fee Edit Modal */}
      <Modal visible={feeModal !== null} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={[typography.heading, { color: colors.brown, fontFamily: `${font}Bold` }]}>
                {t('editFee')}
              </Text>
              <TouchableOpacity onPress={() => setFeeModal(null)}>
                <X size={22} color={colors.brownMuted} />
              </TouchableOpacity>
            </View>
            {feeModal && (
              <Text style={[typography.body, { color: colors.brownMuted, marginBottom: spacing.md, fontFamily: `${font}Regular` }]}>
                {COUNTRIES.find(c => c.code === feeModal.country_code)?.flag} {COUNTRIES.find(c => c.code === feeModal.country_code)?.nameEn}
              </Text>
            )}
            <Text style={[typography.small, { color: colors.brownMuted, marginBottom: 4, fontFamily: `${font}Regular` }]}>
              {t('amount')}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={feeAmount}
              onChangeText={setFeeAmount}
              placeholderTextColor={colors.brownMuted}
              keyboardType="decimal-pad"
            />
            <Text style={[typography.small, { color: colors.brownMuted, marginBottom: 4, marginTop: spacing.sm, fontFamily: `${font}Regular` }]}>
              {t('currency2')}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={feeCurrency}
              onChangeText={setFeeCurrency}
              placeholderTextColor={colors.brownMuted}
            />
            <TouchableOpacity style={styles.modalActionBtn} onPress={handleSaveFee} disabled={busy} activeOpacity={0.8}>
              {busy ? <ActivityIndicator color={colors.white} /> : (
                <>
                  <Save size={20} color={colors.white} />
                  <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>
                    {t('saveFee')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  accessDenied: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl },
  statsGrid: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  statMini: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: colors.border,
  },
  tabBar: { flexDirection: 'row', marginTop: spacing.md, gap: spacing.xs },
  tab: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border,
  },
  tabActive: { borderColor: colors.primary, backgroundColor: colors.surfaceAlt },
  emptyState: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl,
  },
  reqCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1.5, borderColor: colors.border,
  },
  reqCardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  reqNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusPill: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  reqCardDetails: { marginTop: spacing.sm, gap: 4 },
  reqDetailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  notesDisplay: {
    backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, padding: spacing.sm, marginTop: 4,
  },
  reqActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, flex: 1,
  },
  feeRowCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: radius.md, padding: spacing.md, borderWidth: 1.5, borderColor: colors.border,
  },
  editFeeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  revenueCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl,
    alignItems: 'center', gap: spacing.xs, borderWidth: 1.5, borderColor: colors.border,
  },
  revenueIconWrap: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.greenBg,
    justifyContent: 'center', alignItems: 'center',
  },
  breakdownCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1.5, borderColor: colors.border,
  },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  modalCard: {
    backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, width: '100%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalInput: {
    ...typography.body, color: colors.brown,
    backgroundColor: colors.surfaceAlt, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  modalActionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md,
  },
});

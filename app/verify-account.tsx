import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, Linking, RefreshControl,
} from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { supabase, VerificationFee, VerificationRequest } from '@/lib/supabase';
import { getCountryByCode, getCurrencySymbol } from '@/lib/countries';
import { router } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import {
  CheckCircle2, Clock, XCircle, ShieldCheck, Sparkles,
  ArrowLeft, CreditCard, Star, MapPin, BadgeCheck,
} from 'lucide-react-native';

type ScreenMode = 'loading' | 'apply' | 'processing' | 'success' | 'status';

export default function VerifyAccountScreen() {
  const { t, language, rtl, profile, session, refreshProfile } = useAuth();
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';

  const [mode, setMode] = useState<ScreenMode>('loading');
  const [fee, setFee] = useState<VerificationFee | null>(null);
  const [existingReq, setExistingReq] = useState<VerificationRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const countryCode = profile?.country || 'SA';
  const country = getCountryByCode(countryCode);
  const currencySymbol = country
    ? (language === 'ar' ? country.currencySymbolAr : country.currencySymbolEn)
    : fee?.currency || 'USD';

  const loadData = useCallback(async () => {
    if (!session?.user) return;
    const { data: feeData } = await supabase
      .rpc('get_verification_fee', { p_country_code: countryCode })
      .maybeSingle();
    if (feeData) setFee(feeData as VerificationFee);

    const { data: reqData } = await supabase
      .from('verification_requests')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (reqData) setExistingReq(reqData as VerificationRequest);

    if (profile?.is_verified) {
      setMode('status');
    } else if (reqData && (reqData as VerificationRequest).status === 'pending' && (reqData as VerificationRequest).payment_status === 'paid') {
      setMode('status');
    } else {
      setMode('apply');
    }
  }, [session, countryCode, profile?.is_verified]);

  useEffect(() => {
    loadData();
    const sub = supabase
      .channel('verification_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'verification_requests' }, loadData)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    await refreshProfile();
    setRefreshing(false);
  };

  const handlePayAndApply = async () => {
    if (!fee || fee.amount <= 0) return;
    setBusy(true);
    setError('');
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const token = currentSession?.access_token;
      if (!token) {
        setError(t('errorGeneric'));
        setBusy(false);
        return;
      }

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
      const response = await fetch(`${supabaseUrl}/functions/v1/create-verification-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: fee.amount,
          currency: fee.currency,
          country_code: countryCode,
          origin: typeof window !== 'undefined' ? window.location.origin : 'https://sharek.app',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 503) {
          setError(t('paymentNotConfigured'));
        } else if (result.error?.includes('pending')) {
          setError(t('verificationPending'));
          setMode('status');
        } else {
          setError(result.error || t('errorGeneric'));
        }
        setBusy(false);
        return;
      }

      if (result.checkout_url) {
        setMode('processing');
        const supported = await Linking.canOpenURL(result.checkout_url);
        if (supported) {
          await Linking.openURL(result.checkout_url);
        } else {
          setError(t('errorGeneric'));
          setMode('apply');
        }
      }
    } catch {
      setError(t('errorGeneric'));
    }
    setBusy(false);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return language === 'ar'
      ? `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
      : d.toLocaleDateString('en', { dateStyle: 'medium' });
  };

  const statusConfig: Record<string, { color: string; bg: string; icon: React.ReactNode; labelKey: string }> = {
    pending: { color: colors.goldenDark, bg: colors.warningBg, icon: <Clock size={20} color={colors.goldenDark} />, labelKey: 'verificationStatusPending' },
    under_review: { color: colors.goldenDark, bg: colors.warningBg, icon: <Clock size={20} color={colors.goldenDark} />, labelKey: 'verificationStatusPending' },
    approved: { color: '#1DA1F2', bg: 'rgba(29, 161, 242, 0.1)', icon: <CheckCircle2 size={20} color="#1DA1F2" />, labelKey: 'verificationStatusApproved' },
    rejected: { color: colors.error, bg: colors.errorBg, icon: <XCircle size={20} color={colors.error} />, labelKey: 'verificationStatusRejected' },
    suspended: { color: colors.brownMuted, bg: colors.surfaceMuted, icon: <XCircle size={20} color={colors.brownMuted} />, labelKey: 'verificationStatusSuspended' },
  };

  if (mode === 'loading') {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t('getVerified')} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (mode === 'processing') {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t('getVerified')} />
        <View style={styles.processingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[typography.heading, { color: colors.brown, marginTop: spacing.lg, fontFamily: `${font}Bold` }]}>
            {t('processingPayment')}
          </Text>
          <TouchableOpacity style={[styles.secondaryBtn, { marginTop: spacing.xl }]} onPress={() => { setMode('apply'); loadData(); }} activeOpacity={0.8}>
            <Text style={[typography.bodyBold, { color: colors.primary, fontFamily: `${font}Bold` }]}>
              {t('back')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (mode === 'status' && (profile?.is_verified || existingReq)) {
    const sc = profile?.is_verified
      ? statusConfig.approved
      : existingReq
        ? statusConfig[existingReq.status] ?? statusConfig.pending
        : statusConfig.pending;

    return (
      <View style={styles.container}>
        <ScreenHeader title={t('getVerified')} />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.statusCard}>
            <View style={[styles.statusIconWrap, { backgroundColor: sc.bg }]}>
              {sc.icon}
            </View>
            <Text style={[typography.title, { color: colors.brown, marginTop: spacing.md, fontFamily: `${font}Bold`, textAlign: 'center' }]}>
              {profile?.is_verified ? t('verificationApproved') : t(sc.labelKey)}
            </Text>

            {profile?.is_verified && profile.verified_at && (
              <Text style={[typography.caption, { color: colors.brownMuted, marginTop: spacing.sm, fontFamily: `${font}Regular`, textAlign: 'center' }]}>
                {formatDate(profile.verified_at)}
              </Text>
            )}

            {profile?.is_verified && (
              <View style={styles.verifiedShowcase}>
                <VerifiedBadge language={language} size={24} showLabel />
                <Text style={[typography.body, { color: colors.brown, fontFamily: `${font}Regular`, textAlign: 'center', marginTop: spacing.sm }]}>
                  {profile.full_name}
                </Text>
              </View>
            )}

            {!profile?.is_verified && existingReq && (
              <View style={styles.reqDetails}>
                <View style={styles.reqRow}>
                  <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                    {t('verificationFee')}
                  </Text>
                  <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]}>
                    {existingReq.fee_amount.toFixed(2)} {existingReq.fee_currency}
                  </Text>
                </View>
                <View style={styles.reqRow}>
                  <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                    {t('supportDate')}
                  </Text>
                  <Text style={[typography.body, { color: colors.brown, fontFamily: `${font}Regular` }]}>
                    {formatDate(existingReq.created_at)}
                  </Text>
                </View>
                {existingReq.payment_status === 'unpaid' && (
                  <TouchableOpacity
                    style={styles.payBtn}
                    onPress={handlePayAndApply}
                    disabled={busy}
                    activeOpacity={0.8}
                  >
                    {busy ? <ActivityIndicator color={colors.white} size={18} /> : (
                      <>
                        <CreditCard size={20} color={colors.white} />
                        <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>
                          {t('payAndApply')}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
                {existingReq.admin_notes ? (
                  <View style={styles.notesBox}>
                    <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}SemiBold` }]}>
                      {t('adminNotes')}
                    </Text>
                    <Text style={[typography.caption, { color: colors.brownLight, fontFamily: `${font}Regular` }]}>
                      {existingReq.admin_notes}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <Text style={[typography.bodyBold, { color: colors.primary, fontFamily: `${font}Bold` }]}>
                {t('back')}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Apply mode
  return (
    <View style={styles.container}>
      <ScreenHeader title={t('getVerified')} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroBadgeWrap}>
            <View style={styles.heroBadgeCircle}>
              <ShieldCheck size={40} color="#1DA1F2" />
            </View>
            <View style={styles.heroCheck}>
              <CheckCircle2 size={20} color="#1DA1F2" fill="#1DA1F2" />
            </View>
          </View>
          <Text style={[typography.title, { color: colors.brown, marginTop: spacing.md, fontFamily: `${font}Bold`, textAlign: 'center' }]}>
            {t('getVerified')}
          </Text>
          <Text style={[typography.body, { color: colors.brownMuted, marginTop: spacing.sm, fontFamily: `${font}Regular`, textAlign: 'center' }]}>
            {t('getVerifiedDesc')}
          </Text>
        </View>

        {/* Benefits */}
        <View style={styles.benefitsCard}>
          <Text style={[typography.heading, { color: colors.brown, marginBottom: spacing.md, fontFamily: `${font}Bold` }]}>
            {t('verifiedBenefits')}
          </Text>
          {[
            { icon: <BadgeCheck size={18} color="#1DA1F2" />, text: t('verifiedBenefit1') },
            { icon: <Star size={18} color="#1DA1F2" />, text: t('verifiedBenefit2') },
            { icon: <ShieldCheck size={18} color="#1DA1F2" />, text: t('verifiedBenefit3') },
            { icon: <MapPin size={18} color="#1DA1F2" />, text: t('verifiedBenefit4') },
          ].map((b, i) => (
            <View key={i} style={styles.benefitRow}>
              {b.icon}
              <Text style={[typography.body, { color: colors.brown, flex: 1, fontFamily: `${font}Regular` }]}>
                {b.text}
              </Text>
            </View>
          ))}
        </View>

        {/* Fee display */}
        {fee && (
          <View style={styles.feeCard}>
            <View style={styles.feeRow}>
              <Text style={[typography.body, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                {t('verificationFee')}
              </Text>
              <View style={styles.feeAmountWrap}>
                <Text style={[typography.huge, { color: colors.brown, fontSize: 28, fontFamily: `${font}ExtraBold` }]}>
                  {fee.amount.toFixed(2)}
                </Text>
                <Text style={[typography.bodyBold, { color: colors.brownMuted, fontFamily: `${font}Bold` }]}>
                  {currencySymbol}
                </Text>
              </View>
            </View>
            <View style={styles.feeCurrencyRow}>
              <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                {country?.flag} {country?.nameAr} · {fee.currency}
              </Text>
            </View>
          </View>
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={[typography.caption, { color: colors.error, fontFamily: `${font}Regular` }]}>
              {error}
            </Text>
          </View>
        ) : null}

        {/* Pay & Apply button */}
        <TouchableOpacity
          style={styles.payAndApplyBtn}
          onPress={handlePayAndApply}
          disabled={busy || !fee}
          activeOpacity={0.8}
        >
          {busy ? <ActivityIndicator color={colors.white} size={20} /> : (
            <>
              <CreditCard size={22} color={colors.white} />
              <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold`, fontSize: 17 }]}>
                {t('payAndApply')}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={[typography.caption, { color: colors.brownMuted, textAlign: 'center', marginTop: spacing.md, fontFamily: `${font}Regular` }]}>
          {t('securePayment')}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  processingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl },
  heroCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl,
    alignItems: 'center', borderWidth: 1.5, borderColor: colors.border,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 16, elevation: 4,
  },
  heroBadgeWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  heroBadgeCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(29, 161, 242, 0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  heroCheck: { position: 'absolute', bottom: -2, right: -2 },
  benefitsCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    marginTop: spacing.md, borderWidth: 1.5, borderColor: colors.border,
  },
  benefitRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  feeCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    marginTop: spacing.md, borderWidth: 1.5, borderColor: colors.border,
  },
  feeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  feeAmountWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  feeCurrencyRow: { marginTop: spacing.xs },
  errorBox: {
    backgroundColor: colors.errorBg, borderRadius: radius.md, padding: spacing.md,
    marginTop: spacing.md,
  },
  payAndApplyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: '#1DA1F2', borderRadius: radius.lg, paddingVertical: spacing.md + 4,
    marginTop: spacing.lg,
    shadowColor: '#1DA1F2', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  secondaryBtn: {
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingVertical: spacing.md,
    alignItems: 'center', marginTop: spacing.lg, borderWidth: 1.5, borderColor: colors.border,
  },
  statusCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl,
    alignItems: 'center', marginTop: spacing.md, borderWidth: 1.5, borderColor: colors.border,
  },
  statusIconWrap: {
    width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center',
  },
  verifiedShowcase: {
    marginTop: spacing.lg, alignItems: 'center', gap: spacing.xs,
    backgroundColor: 'rgba(29, 161, 242, 0.05)', borderRadius: radius.lg,
    padding: spacing.md, width: '100%',
  },
  reqDetails: { width: '100%', marginTop: spacing.lg, gap: spacing.sm },
  reqRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  payBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: '#1DA1F2', borderRadius: radius.md, paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  notesBox: {
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md,
    marginTop: spacing.sm,
  },
});

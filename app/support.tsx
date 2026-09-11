import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, RefreshControl, Linking,
} from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { supabase, SupportTransaction } from '@/lib/supabase';
import { getCountryByCode } from '@/lib/countries';
import { router } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  Heart, Check, X, Clock, AlertCircle, ArrowLeft, History,
  Sparkles, Shield, ChevronLeft,
} from 'lucide-react-native';

const PRESET_AMOUNTS = [1, 5, 10, 25, 50];

type ScreenMode = 'select' | 'processing' | 'success' | 'failed' | 'cancelled' | 'history';

export default function SupportScreen() {
  const { t, language, rtl, profile, session } = useAuth();
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';

  const [mode, setMode] = useState<ScreenMode>('select');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [completedTx, setCompletedTx] = useState<SupportTransaction | null>(null);
  const [history, setHistory] = useState<SupportTransaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const currency = profile?.currency ?? 'USD';
  const country = profile?.country ? getCountryByCode(profile.country) : null;
  const currencySymbol = country
    ? (language === 'ar' ? country.currencySymbolAr : country.currencySymbolEn)
    : currency;

  const amount = selectedAmount ?? (customAmount ? parseFloat(customAmount) : 0);

  const fetchHistory = useCallback(async () => {
    if (!session?.user) return;
    const { data, error } = await supabase
      .from('support_transactions')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    if (!error && data) {
      setHistory(data as SupportTransaction[]);
    }
  }, [session]);

  useEffect(() => {
    fetchHistory();
    const sub = supabase
      .channel('support_tx_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_transactions' }, fetchHistory)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [fetchHistory]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  };

  const handlePayment = async () => {
    if (amount <= 0) return;
    setBusy(true);
    setErrorMsg('');
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const token = currentSession?.access_token;
      if (!token) {
        setErrorMsg(t('errorGeneric'));
        setBusy(false);
        return;
      }

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
      const response = await fetch(`${supabaseUrl}/functions/v1/create-support-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount,
          currency,
          origin: typeof window !== 'undefined' ? window.location.origin : 'https://sharek.app',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 503) {
          setErrorMsg(t('paymentNotConfigured'));
        } else {
          setErrorMsg(result.error || t('errorGeneric'));
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
          setErrorMsg(t('errorGeneric'));
          setMode('select');
        }
      }
    } catch {
      setErrorMsg(t('errorGeneric'));
    }
    setBusy(false);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return language === 'ar'
      ? `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
      : d.toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const statusConfig: Record<string, { color: string; bg: string; icon: React.ReactNode; labelKey: string }> = {
    pending: { color: colors.goldenDark, bg: colors.warningBg, icon: <Clock size={16} color={colors.goldenDark} />, labelKey: 'statusPending' },
    succeeded: { color: colors.green, bg: colors.greenBg, icon: <Check size={16} color={colors.green} />, labelKey: 'statusSucceeded' },
    failed: { color: colors.error, bg: colors.errorBg, icon: <AlertCircle size={16} color={colors.error} />, labelKey: 'statusFailed' },
    cancelled: { color: colors.brownMuted, bg: colors.surfaceMuted, icon: <X size={16} color={colors.brownMuted} />, labelKey: 'statusCancelled' },
  };

  // --- History View ---
  if (mode === 'history') {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t('supportHistory')} style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl }} />
        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Text style={[typography.caption, { color: colors.brownMuted, marginBottom: spacing.md, fontFamily: `${font}Regular` }]}>
            {t('supportHistoryDesc')}
          </Text>

          {history.length === 0 ? (
            <View style={styles.emptyState}>
              <History size={40} color={colors.brownMuted} />
              <Text style={[typography.body, { color: colors.brownMuted, marginTop: spacing.md, fontFamily: `${font}Regular` }]}>
                {t('noSupportHistory')}
              </Text>
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {history.map((tx) => {
                const sc = statusConfig[tx.status];
                return (
                  <View key={tx.id} style={styles.historyCard}>
                    <View style={styles.historyLeft}>
                      <View style={[styles.historyIcon, { backgroundColor: sc.bg }]}>
                        {sc.icon}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}SemiBold` }]}>
                          {tx.amount.toFixed(2)} {currencySymbol}
                        </Text>
                        <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                          {formatDate(tx.created_at)}
                        </Text>
                        <Text style={[typography.micro, { color: colors.brownMuted, fontFamily: `${font}Regular`, marginTop: 2 }]}>
                          {tx.transaction_ref}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[typography.micro, { color: sc.color, fontFamily: `${font}Bold` }]}>
                        {t(sc.labelKey)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        <View style={styles.footerBar}>
          <TouchableOpacity style={styles.newSupportBtn} onPress={() => setMode('select')} activeOpacity={0.8}>
            <Heart size={20} color={colors.white} />
            <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>
              {t('newSupport')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // --- Success View ---
  if (mode === 'success' && completedTx) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.xxl }}>
          <View style={styles.successIconWrap}>
            <View style={styles.successIconCircle}>
              <Check size={48} color={colors.white} />
            </View>
          </View>

          <Text style={[typography.title, { color: colors.brown, textAlign: 'center', marginTop: spacing.lg, fontFamily: `${font}Bold` }]}>
            {t('thankYou')}
          </Text>
          <Text style={[typography.body, { color: colors.brownMuted, textAlign: 'center', marginTop: spacing.sm, fontFamily: `${font}Regular` }]}>
            {t('thankYouDesc')}
          </Text>

          <View style={styles.successCard}>
            <View style={styles.successRow}>
              <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                {t('supportAmount')}
              </Text>
              <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]}>
                {completedTx.amount.toFixed(2)} {completedTx.currency}
              </Text>
            </View>
            <View style={styles.successDivider} />
            <View style={styles.successRow}>
              <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                {t('supportDate')}
              </Text>
              <Text style={[typography.body, { color: colors.brown, fontFamily: `${font}Regular` }]}>
                {formatDate(completedTx.created_at)}
              </Text>
            </View>
            <View style={styles.successDivider} />
            <View style={styles.successRow}>
              <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                {t('transactionId')}
              </Text>
              <Text style={[typography.small, { color: colors.brown, fontFamily: `${font}SemiBold` }]}>
                {completedTx.transaction_ref}
              </Text>
            </View>
          </View>

          <View style={{ gap: spacing.sm, marginTop: spacing.xl }}>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setMode('history')} activeOpacity={0.8}>
              <History size={20} color={colors.white} />
              <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>
                {t('viewHistory')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setMode('select'); setCompletedTx(null); setSelectedAmount(null); setCustomAmount(''); }} activeOpacity={0.8}>
              <Text style={[typography.bodyBold, { color: colors.primary, fontFamily: `${font}Bold` }]}>
                {t('newSupport')}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // --- Processing View ---
  if (mode === 'processing') {
    return (
      <View style={styles.container}>
        <View style={styles.processingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[typography.heading, { color: colors.brown, marginTop: spacing.lg, fontFamily: `${font}Bold` }]}>
            {t('paymentProcessing')}
          </Text>
          <Text style={[typography.body, { color: colors.brownMuted, textAlign: 'center', marginTop: spacing.sm, fontFamily: `${font}Regular` }]}>
            {t('paymentPending')}
          </Text>
          <TouchableOpacity style={[styles.secondaryBtn, { marginTop: spacing.xl }]} onPress={() => setMode('select')} activeOpacity={0.8}>
            <Text style={[typography.bodyBold, { color: colors.primary, fontFamily: `${font}Bold` }]}>
              {t('backToSupport')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // --- Main Selection View ---
  return (
    <View style={styles.container}>
      <ScreenHeader title={t('supportSharek')} style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl }} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroIconWrap}>
            <Heart size={32} color={colors.white} fill={colors.white} />
          </View>
          <Text style={[typography.heading, { color: colors.brown, textAlign: 'center', marginTop: spacing.md, fontFamily: `${font}Bold` }]}>
            {t('supportSharek')}
          </Text>
          <Text style={[typography.caption, { color: colors.brownMuted, textAlign: 'center', marginTop: spacing.xs, fontFamily: `${font}Regular` }]}>
            {t('supportTagline')}
          </Text>
          <View style={styles.currencyPill}>
            <Text style={[typography.small, { color: colors.brown, fontFamily: `${font}SemiBold` }]}>
              {country?.flag ?? '🌍'} {currency}
            </Text>
          </View>
        </View>

        {/* Amount Selection */}
        <Text style={[typography.small, { color: colors.brownMuted, marginBottom: spacing.sm, marginTop: spacing.lg, fontFamily: `${font}SemiBold` }]}>
          {t('chooseAmount')}
        </Text>

        <View style={styles.amountGrid}>
          {PRESET_AMOUNTS.map((amt) => (
            <TouchableOpacity
              key={amt}
              style={[
                styles.amountChip,
                selectedAmount === amt && styles.amountChipActive,
              ]}
              onPress={() => { setSelectedAmount(amt); setCustomAmount(''); }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  typography.bodyBold,
                  {
                    color: selectedAmount === amt ? colors.white : colors.brown,
                    fontFamily: `${font}Bold`,
                  },
                ]}
              >
                {amt} {currencySymbol}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom Amount */}
        <Text style={[typography.small, { color: colors.brownMuted, marginBottom: spacing.sm, marginTop: spacing.lg, fontFamily: `${font}SemiBold` }]}>
          {t('enterCustomAmount')}
        </Text>
        <View style={styles.customInputWrap}>
          <TextInput
            style={[styles.customInput, { fontFamily: `${font}Regular` }]}
            value={customAmount}
            onChangeText={(text) => {
              setCustomAmount(text);
              setSelectedAmount(null);
            }}
            placeholder="0.00"
            placeholderTextColor={colors.brownMuted}
            keyboardType="decimal-pad"
          />
          <View style={styles.customCurrencyBadge}>
            <Text style={[typography.body, { color: colors.brownMuted, fontFamily: `${font}SemiBold` }]}>
              {currencySymbol}
            </Text>
          </View>
        </View>

        {/* Error */}
        {errorMsg ? (
          <View style={styles.errorBanner}>
            <AlertCircle size={18} color={colors.error} />
            <Text style={[typography.small, { color: colors.error, flex: 1, fontFamily: `${font}Regular` }]}>
              {errorMsg}
            </Text>
          </View>
        ) : null}

        {/* Security Note */}
        <View style={styles.securityNote}>
          <Shield size={16} color={colors.green} />
          <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
            {t('securePayment')}
          </Text>
        </View>

        {/* History Link */}
        <TouchableOpacity
          style={styles.historyLink}
          onPress={() => setMode('history')}
          activeOpacity={0.7}
        >
          <History size={18} color={colors.primary} />
          <Text style={[typography.body, { color: colors.primary, flex: 1, fontFamily: `${font}SemiBold` }]}>
            {t('supportHistory')}
          </Text>
          <ChevronLeft size={20} color={colors.primary} style={{ transform: rtl ? [{ scaleX: -1 }] : [] }} />
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom Payment Button */}
      <View style={styles.footerBar}>
        <TouchableOpacity
          style={[styles.payBtn, amount <= 0 && { opacity: 0.5 }]}
          onPress={handlePayment}
          disabled={amount <= 0 || busy}
          activeOpacity={0.8}
        >
          {busy ? <ActivityIndicator color={colors.white} /> : (
            <>
              <Sparkles size={20} color={colors.white} />
              <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold`, fontSize: 17 }]}>
                {t('proceedToPayment')}
              </Text>
              {amount > 0 && (
                <View style={styles.payAmountBadge}>
                  <Text style={[typography.small, { color: colors.primary, fontFamily: `${font}Bold` }]}>
                    {amount.toFixed(2)} {currencySymbol}
                  </Text>
                </View>
              )}
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Hero
  heroCard: {
    backgroundColor: colors.surfaceAlt, borderRadius: radius.xl,
    padding: spacing.xl, alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border,
    marginTop: spacing.md,
  },
  heroIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  currencyPill: {
    marginTop: spacing.md, backgroundColor: colors.white, borderRadius: radius.pill,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderWidth: 1.5, borderColor: colors.border,
  },

  // Amount grid
  amountGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
  },
  amountChip: {
    width: '31%', paddingVertical: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  amountChipActive: {
    backgroundColor: colors.primary, borderColor: colors.primary,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },

  // Custom input
  customInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md,
  },
  customInput: {
    ...typography.body, flex: 1, color: colors.brown, paddingVertical: spacing.md,
  },
  customCurrencyBadge: {
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
  },

  // Error
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.errorBg, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },

  // Security
  securityNote: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    marginTop: spacing.md, justifyContent: 'center',
  },

  // History link
  historyLink: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    marginTop: spacing.lg, borderWidth: 1.5, borderColor: colors.border,
  },

  // Footer
  footerBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl,
    borderTopWidth: 1.5, borderTopColor: colors.borderLight,
    shadowColor: colors.shadowStrong, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 1, shadowRadius: 16, elevation: 10,
  },
  payBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, borderRadius: radius.lg,
    paddingVertical: spacing.md + 2,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 6,
  },
  payAmountBadge: {
    backgroundColor: colors.white, borderRadius: radius.pill,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  newSupportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: spacing.md,
  },

  // Processing
  processingWrap: {
    flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl,
  },

  // Success
  successIconWrap: { alignItems: 'center', marginTop: spacing.xl },
  successIconCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.green,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.green, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6,
  },
  successCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, marginTop: spacing.xl,
    borderWidth: 1.5, borderColor: colors.border,
  },
  successRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  successDivider: {
    height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.md,
  },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md,
  },
  secondaryBtn: {
    alignItems: 'center', backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md, paddingVertical: spacing.md,
    borderWidth: 1.5, borderColor: colors.border,
  },

  // History
  emptyState: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl,
  },
  historyCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1.5, borderColor: colors.border,
  },
  historyLeft: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1,
  },
  historyIcon: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  statusBadge: {
    borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
  },
});

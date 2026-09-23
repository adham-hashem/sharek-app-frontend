import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { getCountryByCode, getDefaultMealPrice } from '@/lib/countries';
import { supabase, SupportTransaction } from '@/lib/supabase';
import { colors, radius, spacing } from '@/lib/theme';

// Contributions are paused until a real payment provider is configured.
const PAYMENTS_ENABLED = false;

function niceAmount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 5;
  const scale = 10 ** Math.floor(Math.log10(value));
  return Math.max(1, [1, 2, 5, 10].map(n => n * scale).reduce((a, b) => Math.abs(b - value) < Math.abs(a - value) ? b : a));
}

export default function SupportScreen() {
  const { language, profile, session } = useAuth();
  const rtl = language === 'ar';
  const font = rtl ? 'Cairo-' : 'Inter-';
  const country = profile?.country ? getCountryByCode(profile.country) : undefined;
  const currency = country?.currency ?? null;
  const presetAmounts = useMemo(() => {
    if (!currency) return [];
    const base = currency === 'EGP' ? 50 : niceAmount(getDefaultMealPrice(currency));
    return [base, base * 2, base * 5, base * 10];
  }, [currency]);

  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [customSelected, setCustomSelected] = useState(false);
  const [history, setHistory] = useState<SupportTransaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<'paused' | 'error' | null>(null);
  const amount = customSelected ? Number(customAmount) : (selectedAmount ?? 0);
  const validAmount = !!currency && Number.isFinite(amount) && amount > 0 && amount <= 1_000_000_000;

  useEffect(() => {
    setSelectedAmount(null);
    setCustomAmount('');
    setCustomSelected(false);
    setNotice(null);
  }, [currency]);

  const copy = rtl ? {
    title: 'ادعم SHARek', subtitle: 'مساهمتك تساعدنا في تطوير واستمرار SHARek.',
    choose: 'اختر قيمة المساهمة', custom: 'مبلغ آخر', enter: 'أدخل مبلغًا',
    unavailable: 'استقبال المساهمات المالية متوقف مؤقتًا.',
    paused: 'لم تُنشأ مساهمة ولم يُخصم أي مبلغ.', paymentError: 'تعذر بدء الدفع. لم يُخصم أي مبلغ.',
    contributions: 'مساهماتي', empty: 'لا توجد مساهمات حتى الآن.',
    historyError: 'تعذر تحميل المساهمات. حاول مرة أخرى.',
    chooseCountry: 'اختر دولتك أولًا لعرض العملة المناسبة.', countryAction: 'اختيار الدولة',
    invalid: 'أدخل مبلغًا صالحًا.',
  } : {
    title: 'Support SHARek', subtitle: 'Your contribution helps us maintain and improve SHARek.',
    choose: 'Choose a contribution amount', custom: 'Custom amount', enter: 'Enter an amount',
    unavailable: 'Financial contributions are temporarily unavailable.',
    paused: 'No contribution was created and you were not charged.', paymentError: 'Could not start payment. You were not charged.',
    contributions: 'My Contributions', empty: 'No contributions yet.',
    historyError: 'Could not load contributions. Please try again.',
    chooseCountry: 'Choose your country first to display the correct currency.', countryAction: 'Choose country',
    invalid: 'Enter a valid amount.',
  };

  const fetchHistory = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoadingHistory(true);
    const { data, error } = await supabase.from('support_transactions')
      .select('id,user_id,amount,currency,status,stripe_session_id,stripe_payment_intent,transaction_ref,created_at,updated_at')
      .eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(30);
    if (error) setHistoryError(true);
    else { setHistory(data as SupportTransaction[]); setHistoryError(false); }
    setLoadingHistory(false);
  }, [session?.user?.id]);

  useEffect(() => { void fetchHistory(); }, [fetchHistory]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  };

  const updateCustomAmount = (value: string) => {
    const normalized = value.replace(',', '.');
    if (/^\d{0,9}(?:\.\d{0,2})?$/.test(normalized)) {
      setCustomAmount(normalized);
      setCustomSelected(true);
      setSelectedAmount(null);
      setNotice(null);
    }
  };

  const handleSupport = async () => {
    if (!validAmount || !currency || busy) return;
    if (!PAYMENTS_ENABLED) { setNotice('paused'); return; }
    setBusy(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) throw new Error('No session');
      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-support-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentSession.access_token}` },
        body: JSON.stringify({ amount, currency, origin: typeof window !== 'undefined' ? window.location.origin : 'https://sharek.app' }),
      });
      const result = await response.json();
      if (!response.ok || typeof result.checkout_url !== 'string' || new URL(result.checkout_url).protocol !== 'https:' || !await Linking.canOpenURL(result.checkout_url)) throw new Error('Checkout unavailable');
      await Linking.openURL(result.checkout_url);
    } catch { setNotice('error'); }
    finally { setBusy(false); }
  };

  const statusLabel = (status: string) => {
    const labels: Record<string, [string, string]> = {
      succeeded: ['مكتملة', 'Completed'], pending: ['قيد الانتظار', 'Pending'],
      failed: ['فشلت', 'Failed'], cancelled: ['ملغاة', 'Cancelled'],
    };
    return labels[status]?.[rtl ? 0 : 1] ?? status;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={[styles.topRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
            accessibilityRole="button" accessibilityLabel={rtl ? 'رجوع' : 'Back'}>
            {rtl ? <ChevronRight size={21} color={colors.brown} /> : <ChevronLeft size={21} color={colors.brown} />}
          </TouchableOpacity>
        </View>

        <Image source={require('../assets/images/image copy.png')} style={styles.logo} resizeMode="contain" />
        <Text style={[styles.title, { fontFamily: `${font}Bold` }]}>{copy.title}</Text>
        <Text style={[styles.subtitle, { fontFamily: `${font}Regular` }]}>{copy.subtitle}</Text>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontFamily: `${font}Bold`, textAlign: rtl ? 'right' : 'left' }]}>{copy.choose}</Text>
          <View style={[styles.amountGrid, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            {presetAmounts.map(value => (
              <TouchableOpacity key={value} onPress={() => { setSelectedAmount(value); setCustomSelected(false); setCustomAmount(''); setNotice(null); }}
                style={[styles.amountOption, selectedAmount === value && !customSelected && styles.amountOptionSelected]} accessibilityRole="radio"
                accessibilityState={{ selected: selectedAmount === value && !customSelected }}>
                <Text style={[styles.amountText, { fontFamily: `${font}SemiBold` }, selectedAmount === value && !customSelected && styles.amountTextSelected]}>{value.toLocaleString('en-US')} {currency}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => { setCustomSelected(true); setSelectedAmount(null); setNotice(null); }}
              style={[styles.amountOption, customSelected && styles.amountOptionSelected]} accessibilityRole="radio" accessibilityState={{ selected: customSelected }}>
              <Text style={[styles.amountText, { fontFamily: `${font}SemiBold` }, customSelected && styles.amountTextSelected]}>{copy.custom}</Text>
            </TouchableOpacity>
          </View>
          {!currency && <View style={styles.countryPrompt}>
            <Text style={[styles.hint, { fontFamily: `${font}Regular`, textAlign: rtl ? 'right' : 'left' }]}>{copy.chooseCountry}</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/country' as never)} accessibilityRole="button">
              <Text style={[styles.countryAction, { fontFamily: `${font}SemiBold` }]}>{copy.countryAction}</Text>
            </TouchableOpacity>
          </View>}

          <Text style={[styles.inputLabel, { fontFamily: `${font}SemiBold`, textAlign: rtl ? 'right' : 'left' }]}>{copy.enter}</Text>
          <View style={[styles.inputRow, { flexDirection: rtl ? 'row-reverse' : 'row' }, customSelected && styles.inputRowActive]}>
            <TextInput style={[styles.input, { fontFamily: `${font}Regular`, textAlign: rtl ? 'right' : 'left' }]}
              value={customAmount} onChangeText={updateCustomAmount} onFocus={() => { setCustomSelected(true); setSelectedAmount(null); }}
              placeholder={rtl ? 'أدخل مبلغًا' : 'Enter an amount'} placeholderTextColor={colors.brownMuted}
              keyboardType="decimal-pad" accessibilityLabel={copy.enter} />
            <Text style={[styles.currencyCode, { fontFamily: `${font}SemiBold` }]}>{currency ?? '—'}</Text>
          </View>
          {customSelected && !!customAmount && !validAmount && <Text style={[styles.hint, { fontFamily: `${font}Regular` }]}>{copy.invalid}</Text>}
        </View>

        <TouchableOpacity onPress={handleSupport} disabled={!validAmount || busy} activeOpacity={0.8}
          style={[styles.primaryButton, (!validAmount || busy) && styles.primaryButtonDisabled]} accessibilityRole="button"
          accessibilityState={{ disabled: !validAmount || busy }}>
          {busy ? <ActivityIndicator color={colors.white} /> : <Text style={[styles.primaryText, { fontFamily: `${font}Bold` }]}>
            {copy.title}{validAmount ? ` — ${amount.toLocaleString('en-US')} ${currency}` : ''}
          </Text>}
        </TouchableOpacity>
        {!PAYMENTS_ENABLED && <Text style={[styles.availability, { fontFamily: `${font}Regular` }]}>{copy.unavailable}</Text>}
        {notice && <Text style={[styles.notice, { fontFamily: `${font}SemiBold` }]}>{notice === 'paused' ? copy.paused : copy.paymentError}</Text>}

        <View style={styles.historySection}>
          <Text style={[styles.sectionTitle, { fontFamily: `${font}Bold`, textAlign: rtl ? 'right' : 'left' }]}>{copy.contributions}</Text>
          {loadingHistory && history.length === 0 ? <ActivityIndicator color={colors.primary} style={styles.historyLoading} /> :
            historyError ? <TouchableOpacity onPress={fetchHistory}><Text style={[styles.emptyHistory, { fontFamily: `${font}Regular` }]}>{copy.historyError}</Text></TouchableOpacity> :
            history.length === 0 ? <Text style={[styles.emptyHistory, { fontFamily: `${font}Regular` }]}>{copy.empty}</Text> :
            history.map(tx => (
              <View key={tx.id} style={[styles.historyRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                <View style={styles.historyDetails}>
                  <Text style={[styles.historyAmount, { fontFamily: `${font}Bold`, textAlign: rtl ? 'right' : 'left' }]}>{Number(tx.amount).toLocaleString('en-US')} {tx.currency}</Text>
                  <Text style={[styles.historyDate, { fontFamily: `${font}Regular`, textAlign: rtl ? 'right' : 'left' }]}>
                    {new Intl.DateTimeFormat(rtl ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(tx.created_at))}
                  </Text>
                </View>
                <Text style={[styles.status, { fontFamily: `${font}SemiBold`, color: tx.status === 'succeeded' ? colors.greenDark : colors.brownMuted }]}>{statusLabel(tx.status)}</Text>
              </View>
            ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  topRow: { minHeight: 48, alignItems: 'center', marginTop: spacing.sm },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  logo: { width: 144, height: 96, alignSelf: 'center', marginTop: spacing.xs },
  title: { color: colors.brown, fontSize: 24, lineHeight: 36, textAlign: 'center', marginTop: spacing.sm },
  subtitle: { color: colors.brownMuted, fontSize: 13, lineHeight: 23, textAlign: 'center', marginTop: 4, marginBottom: spacing.lg },
  section: { backgroundColor: colors.surfaceAlt, borderRadius: radius.xl, padding: spacing.lg },
  sectionTitle: { color: colors.brown, fontSize: 17, lineHeight: 28 },
  amountGrid: { flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  amountOption: { minHeight: 48, minWidth: '30%', flexGrow: 1, borderRadius: radius.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  amountOptionSelected: { backgroundColor: colors.primary },
  amountText: { color: colors.brown, fontSize: 13, textAlign: 'center' },
  amountTextSelected: { color: colors.white },
  inputLabel: { color: colors.brown, fontSize: 13, marginTop: spacing.lg, marginBottom: spacing.sm },
  inputRow: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.white, alignItems: 'center', paddingHorizontal: spacing.md },
  inputRowActive: { borderWidth: 1, borderColor: colors.primary },
  input: { flex: 1, color: colors.brown, fontSize: 15, paddingVertical: spacing.sm },
  currencyCode: { color: colors.greenDark, fontSize: 13, paddingHorizontal: spacing.xs },
  hint: { color: colors.coralDark, fontSize: 12, marginTop: spacing.sm },
  countryPrompt: { gap: spacing.xs },
  countryAction: { color: colors.primaryDark, fontSize: 13 },
  primaryButton: { minHeight: 54, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg, paddingHorizontal: spacing.md, shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.13, shadowRadius: 7, elevation: 2 },
  primaryButtonDisabled: { opacity: 0.48 },
  primaryText: { color: colors.white, fontSize: 15, textAlign: 'center' },
  availability: { color: colors.brownMuted, fontSize: 11, lineHeight: 18, textAlign: 'center', marginTop: spacing.sm },
  notice: { color: colors.brown, backgroundColor: colors.surfaceAlt, fontSize: 12, lineHeight: 20, textAlign: 'center', marginTop: spacing.sm, padding: spacing.sm, borderRadius: radius.md },
  historySection: { marginTop: spacing.xl },
  historyLoading: { marginTop: spacing.lg },
  emptyHistory: { color: colors.brownMuted, fontSize: 13, lineHeight: 22, marginTop: spacing.md, paddingVertical: spacing.md, textAlign: 'center', backgroundColor: colors.surfaceAlt, borderRadius: radius.md },
  historyRow: { minHeight: 68, alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginTop: spacing.sm },
  historyDetails: { flex: 1 },
  historyAmount: { color: colors.brown, fontSize: 14 },
  historyDate: { color: colors.brownMuted, fontSize: 11, marginTop: 3 },
  status: { fontSize: 11, marginHorizontal: spacing.sm },
});

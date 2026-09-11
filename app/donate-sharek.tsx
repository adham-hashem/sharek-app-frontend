import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { supabase, AppDonation } from '@/lib/supabase';
import { getCurrencySymbol } from '@/lib/countries';
import { DollarSign, CheckCircle2, Heart, History } from 'lucide-react-native';
import { router } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';

const PRESETS = [10, 25, 50, 100, 250];

export default function DonateSharekScreen() {
  const { t, language, user, profile } = useAuth();
  const currency = profile?.currency || 'SAR';
  const currencySymbol = getCurrencySymbol(currency, language);
  const [amount, setAmount] = useState<number | null>(25);
  const [custom, setCustom] = useState('');
  const [step, setStep] = useState<'choose' | 'confirm' | 'done'>('choose');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<AppDonation[]>([]);
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';

  const finalAmount = amount ?? (custom ? parseFloat(custom) : 0);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('app_donations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setHistory(data as AppDonation[]);
  }, [user]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const proceed = () => {
    if (finalAmount < 1) {
      Alert.alert(t('errorGeneric'));
      return;
    }
    setStep('confirm');
  };

  const confirmDonation = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from('app_donations').insert({
      amount: finalAmount,
      currency,
    });
    setBusy(false);
    if (error) {
      Alert.alert(t('errorGeneric'));
      return;
    }
    setStep('done');
    loadHistory();
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return language === 'ar'
      ? `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
      : d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <ScreenHeader title={t('donateToSharek')} onBack={step === 'choose' ? undefined : () => setStep('choose')} />

      {step === 'choose' && (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <View style={styles.heroCard}>
            <View style={[styles.heroIcon, { backgroundColor: colors.golden }]}>
              <Heart size={32} color={colors.white} />
            </View>
            <Text style={[typography.heading, { color: colors.brown, textAlign: 'center', marginTop: spacing.md, fontFamily: `${font}Bold` }]}>
              {t('donateToSharek')}
            </Text>
            <Text style={[typography.caption, { color: colors.brownMuted, textAlign: 'center', marginTop: spacing.xs, fontFamily: `${font}Regular` }]}>
              {t('donateToSharekDesc')}
            </Text>
          </View>

          <Text style={[typography.bodyBold, { color: colors.brown, marginBottom: spacing.md, fontFamily: `${font}Bold` }]}>
            {t('donationAmount')} ({currencySymbol})
          </Text>

          <View style={styles.presetGrid}>
            {PRESETS.map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.preset, amount === p && styles.presetActive]}
                onPress={() => { setAmount(p); setCustom(''); }}
                activeOpacity={0.7}
              >
                <Text style={[typography.bodyBold, { color: amount === p ? colors.white : colors.brown, fontFamily: `${font}Bold` }]}>
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.customInput}
            placeholder={t('donationAmount')}
            value={custom}
            onChangeText={(v) => { setCustom(v); setAmount(null); }}
            keyboardType="numeric"
            placeholderTextColor={colors.brownMuted}
          />

          <TouchableOpacity style={styles.btn} onPress={proceed} activeOpacity={0.8}>
            <DollarSign size={22} color={colors.white} />
            <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>
              {t('confirmDonation')}
            </Text>
          </TouchableOpacity>

          {history.length > 0 && (
            <View style={{ marginTop: spacing.xl }}>
              <View style={styles.historyHeader}>
                <History size={18} color={colors.brownMuted} />
                <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]}>
                  {t('recentActivity')}
                </Text>
              </View>
              {history.map((d) => (
                <View key={d.id} style={styles.historyCard}>
                  <View style={[styles.historyIcon, { backgroundColor: colors.warningBg }]}>
                    <DollarSign size={16} color={colors.goldenDark} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]}>
                      {d.amount} {getCurrencySymbol(d.currency, language)}
                    </Text>
                    <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                      {formatDate(d.created_at)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {step === 'confirm' && (
        <View style={styles.confirmCard}>
          <Text style={[typography.body, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
            {t('donationAmount')}
          </Text>
          <Text style={[typography.huge, { color: colors.brown, marginVertical: spacing.sm, fontFamily: `${font}ExtraBold` }]}>
            {finalAmount} {currencySymbol}
          </Text>
          <Text style={[typography.caption, { color: colors.brownMuted, marginBottom: spacing.lg, fontFamily: `${font}Regular` }]}>
            {t('payment')}
          </Text>

          <TouchableOpacity style={styles.btn} onPress={confirmDonation} disabled={busy} activeOpacity={0.8}>
            {busy ? <ActivityIndicator color={colors.white} /> : (
              <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>
                {t('donateMoney')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {step === 'done' && (
        <View style={styles.successCard}>
          <View style={[styles.statusIcon, { backgroundColor: colors.greenBg }]}>
            <CheckCircle2 size={48} color={colors.green} />
          </View>
          <Text style={[typography.title, { color: colors.greenDark, marginTop: spacing.md, fontFamily: `${font}Bold` }]}>
            {t('donationSuccess')}
          </Text>
          <Text style={[typography.huge, { color: colors.brown, marginTop: spacing.sm, fontFamily: `${font}ExtraBold` }]}>
            {finalAmount} {currencySymbol}
          </Text>
          <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(tabs)')}>
            <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>{t('confirm')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  heroCard: {
    backgroundColor: colors.surfaceAlt, borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.goldenLight, marginBottom: spacing.xl,
  },
  heroIcon: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  preset: {
    width: '31%', flexGrow: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingVertical: spacing.md,
    borderWidth: 2, borderColor: colors.border,
  },
  presetActive: { backgroundColor: colors.golden, borderColor: colors.golden },
  customInput: {
    ...typography.body, color: colors.brown,
    backgroundColor: colors.surfaceAlt, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    marginTop: spacing.md, marginBottom: spacing.xl,
  },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.golden, borderRadius: radius.md, paddingVertical: spacing.md,
    shadowColor: colors.golden, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  confirmCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center',
    marginHorizontal: spacing.lg, borderWidth: 1.5, borderColor: colors.border,
  },
  successCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center',
    marginHorizontal: spacing.lg, borderWidth: 1.5, borderColor: colors.border,
  },
  statusIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  historyHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  historyCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  historyIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
});

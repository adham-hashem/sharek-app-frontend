import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Heart, PackageCheck, UtensilsCrossed } from 'lucide-react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors, radius, spacing, typography } from '@/lib/theme';

type HistoryPayload = {
  donations: Array<{ id: string; amount: number; currency: string; meal_count?: number | null; payment_status?: string | null; created_at: string }>;
  requests: Array<{ id: string; meals: number; status: string; created_at: string }>;
  food_claims: Array<{ id: string; status: string; created_at: string }>;
  matches: Array<{ id: string; delivery_status: string; status: string; created_at: string }>;
};

export default function HistoryScreen() {
  const { t, language } = useAuth();
  const [data, setData] = useState<HistoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';

  const load = useCallback(async () => {
    setError(false);
    try {
      setData(await apiFetch<HistoryPayload>('/v1/history'));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const date = (value: string) => new Date(value).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en', { dateStyle: 'medium' });
  const statusLabel = (value: string) => {
    const labels: Record<string, string> = {
      open: language === 'ar' ? 'مفتوح' : 'Open',
      matched: language === 'ar' ? 'تم القبول' : 'Matched',
      fulfilled: language === 'ar' ? 'مكتمل' : 'Completed',
      cancelled: language === 'ar' ? 'ملغي' : 'Cancelled',
      accepted: language === 'ar' ? 'تم القبول' : 'Accepted',
      awaiting_pickup: language === 'ar' ? 'في انتظار الاستلام' : 'Awaiting pickup',
      delivered: language === 'ar' ? 'تم الاستلام' : 'Received',
      completed: language === 'ar' ? 'مكتمل' : 'Completed',
      pending: language === 'ar' ? 'في انتظار الدفع' : 'Payment pending',
      paid: language === 'ar' ? 'مدفوع' : 'Paid',
      recorded: language === 'ar' ? 'مسجل' : 'Recorded',
    };
    return labels[value] ?? value;
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
    >
      <ScreenHeader title={t('history')} />
      {error && <Text style={[styles.empty, { fontFamily: `${font}Regular` }]}>{t('errorGeneric')}</Text>}
      {!error && data && (
        <>
          <Section title={language === 'ar' ? 'التبرعات المالية' : 'Money donations'} icon={<Heart size={19} color={colors.coral} />}>
            {data.donations.length === 0 ? <Empty font={font} text={language === 'ar' ? 'لا توجد تبرعات بعد' : 'No donations yet'} /> : data.donations.map((item) => (
              <Row key={item.id} title={`${item.amount} ${item.currency}`} subtitle={`${item.meal_count ?? 0} ${t('meals')} · ${date(item.created_at)}`} status={statusLabel(item.payment_status ?? 'pending')} font={font} />
            ))}
          </Section>
          <Section title={language === 'ar' ? 'طلبات الوجبات' : 'Meal requests'} icon={<UtensilsCrossed size={19} color={colors.primary} />}>
            {data.requests.length === 0 ? <Empty font={font} text={language === 'ar' ? 'لا توجد طلبات بعد' : 'No requests yet'} /> : data.requests.map((item) => (
              <Row key={item.id} title={`${item.meals} ${t('meals')}`} subtitle={date(item.created_at)} status={statusLabel(item.status)} font={font} />
            ))}
          </Section>
          <Section title={language === 'ar' ? 'المطابقات والاستلام' : 'Matches and pickups'} icon={<PackageCheck size={19} color={colors.green} />}>
            {data.matches.length === 0 && data.food_claims.length === 0 ? <Empty font={font} text={language === 'ar' ? 'لا توجد عمليات بعد' : 'No operations yet'} /> : <>
              {data.matches.map((item) => <Row key={`match-${item.id}`} title={language === 'ar' ? 'مطابقة وجبة' : 'Meal match'} subtitle={date(item.created_at)} status={statusLabel(item.delivery_status)} font={font} />)}
              {data.food_claims.map((item) => <Row key={`claim-${item.id}`} title={language === 'ar' ? 'حجز طعام' : 'Food claim'} subtitle={date(item.created_at)} status={statusLabel(item.status)} font={font} />)}
            </>}
          </Section>
        </>
      )}
    </ScrollView>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <View style={styles.section}><View style={styles.sectionTitle}>{icon}<Text style={styles.sectionTitleText}>{title}</Text></View>{children}</View>;
}

function Row({ title, subtitle, status, font }: { title: string; subtitle: string; status: string; font: string }) {
  return <View style={styles.row}><View style={{ flex: 1 }}><Text style={[styles.rowTitle, { fontFamily: `${font}Bold` }]}>{title}</Text><Text style={[styles.rowSub, { fontFamily: `${font}Regular` }]}>{subtitle}</Text></View><Text style={[styles.status, { fontFamily: `${font}SemiBold` }]}>{status}</Text></View>;
}

function Empty({ text, font }: { text: string; font: string }) { return <Text style={[styles.empty, { fontFamily: `${font}Regular` }]}>{text}</Text>; }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  section: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.md },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  sectionTitleText: { ...typography.bodyBold, color: colors.brown },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight, paddingVertical: spacing.sm },
  rowTitle: { ...typography.body, color: colors.brown },
  rowSub: { ...typography.small, color: colors.brownMuted, marginTop: 2 },
  status: { ...typography.small, color: colors.greenDark, maxWidth: 125, textAlign: 'right' },
  empty: { ...typography.body, color: colors.brownMuted, textAlign: 'center', paddingVertical: spacing.md },
});

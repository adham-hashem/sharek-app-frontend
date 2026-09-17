import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Check, ChevronLeft, Save } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { apiFetch, apiPatch } from '@/lib/api';
import { colors, radius, spacing, typography } from '@/lib/theme';
import { ScreenHeader } from '@/components/ScreenHeader';

type MealType = { id: string; name: string; description: string; price_usd: number; is_active: boolean };
type PriceChange = { id: string; meal_type_id: string; old_price_usd: number; new_price_usd: number; changed_at: string };

export default function AdminScreen() {
  const { language, profile, t } = useAuth();
  const [items, setItems] = useState<MealType[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceChange[]>([]);
  const [busy, setBusy] = useState(true);
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';
  const isAdmin = profile?.is_admin === true;

  const load = useCallback(async () => {
    if (!isAdmin) { setBusy(false); return; }
    try {
      const result = await apiFetch<{ items: MealType[] }>('/v1/admin/meal-types');
      setItems(result.items);
      const history = await apiFetch<{ items: PriceChange[] }>('/v1/admin/price-history');
      setPriceHistory(history.items);
    } catch { Alert.alert(language === 'ar' ? 'تعذر تحميل الأسعار' : 'Could not load prices'); }
    finally { setBusy(false); }
  }, [isAdmin, language]);

  useEffect(() => { load(); }, [load]);

  const save = async (item: MealType) => {
    try {
      const updated = await apiPatch<MealType>(`/v1/admin/meal-types/${item.id}`, { name: item.name, description: item.description, price_usd: Number(item.price_usd), is_active: item.is_active });
      setItems((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
    } catch { Alert.alert(language === 'ar' ? 'تعذر حفظ السعر' : 'Could not save price'); }
  };

  if (busy) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  if (!isAdmin) return (
    <View style={styles.forbidden}>
      <ScreenHeader title={t('adminPricing')} />
      <View style={styles.forbiddenBody}>
        <Text style={[typography.heading, { color: colors.brown, fontFamily: `${font}Bold` }]}>403</Text>
        <Text style={[typography.body, styles.forbiddenText, { fontFamily: `${font}Regular` }]}>
          {language === 'ar' ? 'هذه الصفحة مخصصة لفريق الإدارة فقط.' : 'This page is available to administrators only.'}
        </Text>
        <TouchableOpacity style={styles.returnButton} onPress={() => router.replace('/(tabs)')}>
          <Text style={[typography.small, { color: colors.white, fontFamily: `${font}Bold` }]}>
            {language === 'ar' ? 'العودة للرئيسية' : 'Back to home'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={colors.brown} /></TouchableOpacity>
      <Text style={[typography.heading, { color: colors.brown, fontFamily: `${font}Bold` }]}>{t('adminPricing')}</Text>
      <View style={{ width: 24 }} />
    </View>
    <Text style={[typography.caption, { color: colors.brownMuted, fontFamily: `${font}Regular`, marginBottom: spacing.lg }]}>{language === 'ar' ? 'السعر الأساسي بالدولار، مع حفظ سجل كل تعديل.' : 'Global USD pricing with an audit trail for every change.'}</Text>
    {items.map((item) => <View key={item.id} style={styles.card}>
      <TextInput style={styles.input} value={item.name} onChangeText={(name) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, name } : entry))} />
      <TextInput style={styles.input} value={item.description} onChangeText={(description) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, description } : entry))} multiline />
      <TextInput style={styles.input} value={String(item.price_usd)} keyboardType="decimal-pad" onChangeText={(price) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, price_usd: Number(price) || 0 } : entry))} />
      <TouchableOpacity style={styles.save} onPress={() => save(item)}><Save size={17} color={colors.white} /><Text style={[typography.small, { color: colors.white, fontFamily: `${font}Bold` }]}>حفظ السعر</Text></TouchableOpacity>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={[typography.micro, { color: colors.greenDark, fontFamily: `${font}Regular` }]}>{item.is_active ? (language === 'ar' ? 'مفعلة' : 'Active') : (language === 'ar' ? 'متوقفة' : 'Inactive')}</Text><Switch value={item.is_active} onValueChange={(is_active) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, is_active } : entry))} /><Check size={12} color={colors.greenDark} /></View>
    </View>)}
    {priceHistory.length > 0 && <View style={styles.history}><Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]}>{language === 'ar' ? 'سجل تغييرات الأسعار' : 'Price change history'}</Text>{priceHistory.map((change) => <Text key={change.id} style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>{change.old_price_usd} → {change.new_price_usd} USD · {new Date(change.changed_at).toLocaleDateString()}</Text>)}</View>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  forbidden: { flex: 1, backgroundColor: colors.background },
  forbiddenBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  forbiddenText: { color: colors.brownMuted, textAlign: 'center' },
  returnButton: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  input: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.sm, color: colors.brown, borderWidth: 1, borderColor: colors.border },
  save: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.primary },
  history: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs, borderWidth: 1, borderColor: colors.border },
});

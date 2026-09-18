import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { colors, radius, spacing, typography } from '@/lib/theme';
type Report = { id: string; category: string; description: string; status: string; created_at: string };
export default function AdminReports() { const { profile, language } = useAuth(); const [rows, setRows] = useState<Report[]>([]); const [busy, setBusy] = useState(true); const ar = language === 'ar';
  const load = useCallback(async () => { setBusy(true); const { data } = await supabase.from('user_reports').select('*').order('created_at', { ascending: false }); setRows((data ?? []) as Report[]); setBusy(false); }, []);
  useEffect(() => { if (profile?.is_admin) void load(); else setBusy(false); }, [profile?.is_admin, load]);
  const resolve = async (item: Report) => { await supabase.from('user_reports').update({ status: item.status === 'resolved' ? 'open' : 'resolved', reviewed_by: profile?.id, reviewed_at: new Date().toISOString() }).eq('id', item.id); void load(); };
  if (!profile?.is_admin) return <View style={styles.center}><Text>{ar ? 'غير مصرح' : 'Access denied'}</Text></View>;
  return <View style={styles.container}><ScreenHeader title={ar ? 'بلاغات المستخدمين' : 'User reports'} onBack={() => router.replace('/admin-dashboard' as never)} />{busy ? <ActivityIndicator style={styles.center} color={colors.primary} /> : <FlatList data={rows} keyExtractor={x => x.id} contentContainerStyle={styles.list} renderItem={({ item }) => <View style={styles.card}><Text style={styles.name}>{item.category} · {item.status}</Text><Text style={styles.desc}>{item.description}</Text><TouchableOpacity style={styles.action} onPress={() => resolve(item)}><Text style={styles.actionText}>{item.status === 'resolved' ? (ar ? 'إعادة فتح البلاغ' : 'Reopen') : (ar ? 'تمت المعالجة' : 'Mark resolved')}</Text></TouchableOpacity></View>} ListEmptyComponent={<Text style={styles.empty}>{ar ? 'لا توجد بلاغات.' : 'No reports.'}</Text>} />}</View>;
}
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: colors.background }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, list: { padding: spacing.lg, gap: spacing.md }, card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border }, name: { ...typography.bodyBold, color: colors.brown }, desc: { ...typography.body, color: colors.brownMuted, marginTop: spacing.sm }, action: { marginTop: spacing.md, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.greenBg, alignItems: 'center' }, actionText: { ...typography.bodyBold, color: colors.brown }, empty: { ...typography.body, color: colors.brownMuted, textAlign: 'center' } });

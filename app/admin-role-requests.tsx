import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import { Building2, CheckCircle2, ShieldCheck, XCircle } from 'lucide-react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuth } from '@/lib/auth';
import { supabase, UserMode, UserRole } from '@/lib/supabase';
import { colors, radius, spacing, typography } from '@/lib/theme';

type RoleRequestStatus = 'pending' | 'approved' | 'rejected';
type RoleRequest = {
  id: string;
  user_id: string;
  requester_name: string;
  requester_email: string;
  requested_role: Exclude<UserRole, 'needer' | 'donor' | 'skipped'>;
  requested_mode: UserMode;
  status: RoleRequestStatus;
  admin_notes: string;
  created_at: string;
  reviewed_at: string | null;
};

const roleLabels = {
  ar: {
    charity: 'جمعية خيرية',
    organization: 'مؤسسة',
    restaurant: 'مطعم',
    hotel: 'فندق',
    needer: 'محتاج',
    donor: 'شريك/متبرع',
  },
  en: {
    charity: 'Charity',
    organization: 'Organization',
    restaurant: 'Restaurant',
    hotel: 'Hotel',
    needer: 'In need',
    donor: 'Partner/Donor',
  },
};

export default function AdminRoleRequestsScreen() {
  const { profile, language, t } = useAuth();
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';
  const isAdmin = profile?.is_admin === true;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<RoleRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  const labels = roleLabels[language];

  const load = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const { data, error } = await supabase
      .from('role_approval_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      Alert.alert(t('errorGeneric'));
    } else {
      setRequests((data ?? []) as RoleRequest[]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [isAdmin, t]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const approve = async (item: RoleRequest) => {
    setBusyId(item.id);
    const { error } = await supabase.rpc('admin_approve_role_request', {
      p_request_id: item.id,
      p_notes: notesById[item.id] ?? '',
    });
    setBusyId(null);
    if (error) {
      Alert.alert(t('errorGeneric'));
      return;
    }
    load();
  };

  const reject = async (item: RoleRequest) => {
    setBusyId(item.id);
    const { error } = await supabase.rpc('admin_reject_role_request', {
      p_request_id: item.id,
      p_notes: notesById[item.id] ?? '',
    });
    setBusyId(null);
    if (error) {
      Alert.alert(t('errorGeneric'));
      return;
    }
    load();
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    return language === 'ar'
      ? `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`
      : date.toLocaleDateString('en', { dateStyle: 'medium' });
  };

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={language === 'ar' ? 'طلبات الأدوار' : 'Role Requests'} onBack={() => router.replace('/admin-dashboard' as never)} />
        <View style={styles.center}>
          <ShieldCheck size={52} color={colors.brownMuted} />
          <Text style={[typography.body, { color: colors.brownMuted, marginTop: spacing.md, fontFamily: `${font}Regular` }]}>
            {language === 'ar' ? 'هذه الصفحة مخصصة للأدمن فقط.' : 'This page is only available to admins.'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={language === 'ar' ? 'طلبات الأدوار' : 'Role Requests'} onBack={() => router.replace('/admin-dashboard' as never)} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.infoCard}>
            <Building2 size={26} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]}>
                {language === 'ar' ? 'ما الذي تؤكده هنا؟' : 'What do you approve here?'}
              </Text>
              <Text style={[typography.caption, { color: colors.brownMuted, marginTop: 2, fontFamily: `${font}Regular` }]}>
                {language === 'ar'
                  ? 'أي حساب يطلب دور جمعية/مؤسسة/مطعم/فندق يظهر هنا. عند القبول يتم تحديث دوره ووضعه في جدول profiles.'
                  : 'Accounts requesting charity/organization/restaurant/hotel roles appear here. Approval updates their role and mode in profiles.'}
              </Text>
            </View>
          </View>

          {requests.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[typography.body, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                {language === 'ar' ? 'لا توجد طلبات أدوار حتى الآن.' : 'No role requests yet.'}
              </Text>
            </View>
          ) : requests.map((item) => {
            const pending = item.status === 'pending';
            const statusColor = item.status === 'approved' ? colors.green : item.status === 'rejected' ? colors.error : colors.goldenDark;
            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.avatar}>
                    <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>
                      {(item.requester_name || item.requester_email || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]} numberOfLines={1}>
                      {item.requester_name || 'SHARek User'}
                    </Text>
                    <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]} numberOfLines={1}>
                      {item.requester_email}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                    <Text style={[typography.micro, { color: statusColor, fontFamily: `${font}Bold` }]}>
                      {item.status === 'pending'
                        ? (language === 'ar' ? 'قيد المراجعة' : 'Pending')
                        : item.status === 'approved'
                          ? (language === 'ar' ? 'مقبول' : 'Approved')
                          : (language === 'ar' ? 'مرفوض' : 'Rejected')}
                    </Text>
                  </View>
                </View>

                <View style={styles.details}>
                  <Text style={[typography.small, { color: colors.brown, fontFamily: `${font}SemiBold` }]}>
                    {language === 'ar' ? 'الدور المطلوب' : 'Requested role'}: {labels[item.requested_role]}
                  </Text>
                  <Text style={[typography.small, { color: colors.brown, fontFamily: `${font}SemiBold` }]}>
                    {language === 'ar' ? 'الوضع' : 'Mode'}: {labels[item.requested_mode]}
                  </Text>
                  <Text style={[typography.micro, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                    {language === 'ar' ? 'تاريخ الطلب' : 'Requested'}: {formatDate(item.created_at)}
                  </Text>
                  {item.admin_notes ? (
                    <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                      {language === 'ar' ? 'ملاحظات الأدمن' : 'Admin notes'}: {item.admin_notes}
                    </Text>
                  ) : null}
                </View>

                {pending && (
                  <>
                    <TextInput
                      style={[styles.notesInput, { fontFamily: `${font}Regular` }]}
                      value={notesById[item.id] ?? ''}
                      onChangeText={(value) => setNotesById((current) => ({ ...current, [item.id]: value }))}
                      placeholder={language === 'ar' ? 'ملاحظات اختيارية للأدمن' : 'Optional admin notes'}
                      placeholderTextColor={colors.brownMuted}
                      multiline
                    />
                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: colors.green }]}
                        onPress={() => approve(item)}
                        disabled={busyId === item.id}
                        activeOpacity={0.8}
                      >
                        {busyId === item.id ? <ActivityIndicator color={colors.white} size="small" /> : <CheckCircle2 size={18} color={colors.white} />}
                        <Text style={[typography.small, { color: colors.white, fontFamily: `${font}Bold` }]}>
                          {language === 'ar' ? 'قبول' : 'Approve'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: colors.error }]}
                        onPress={() => reject(item)}
                        disabled={busyId === item.id}
                        activeOpacity={0.8}
                      >
                        {busyId === item.id ? <ActivityIndicator color={colors.white} size="small" /> : <XCircle size={18} color={colors.white} />}
                        <Text style={[typography.small, { color: colors.white, fontFamily: `${font}Bold` }]}>
                          {language === 'ar' ? 'رفض' : 'Reject'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  infoCard: {
    flexDirection: 'row', gap: spacing.md, alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg,
    borderWidth: 1.5, borderColor: colors.border, marginBottom: spacing.md,
  },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg,
    borderWidth: 1.5, borderColor: colors.border, marginBottom: spacing.md,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  statusBadge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  details: { gap: 3, marginTop: spacing.md },
  notesInput: {
    ...typography.small, color: colors.brown,
    minHeight: 70, textAlignVertical: 'top',
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
    padding: spacing.md, marginTop: spacing.md,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    borderRadius: radius.md, paddingVertical: spacing.md,
  },
});

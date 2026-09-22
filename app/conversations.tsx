import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, Image,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { supabase, Profile } from '@/lib/supabase';
import { apiFetch } from '@/lib/api';
import {
  ChevronLeft, MessageCircle, UtensilsCrossed, Send,
} from 'lucide-react-native';
import { AchievementBadgeMini } from '@/components/AchievementBadge';

interface ConversationRow {
  id: string;
  other_user_id: string;
  other_user: Profile | null;
  unread_count: number;
  last_message_at: string;
  last_message: { body: string; created_at: string; food_donation_id: string | null; meal_request_id: string | null } | null;
}

export default function ConversationsScreen() {
  const { t, language, user } = useAuth();
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';
  const rtl = language === 'ar';

  const load = useCallback(async () => {
    if (!user) return;

    const result = await apiFetch<{ items: ConversationRow[] }>('/v1/conversations').catch(() => ({ items: [] }));
    setRows(result.items);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    const sub = supabase
      .channel('conversations_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_claims' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, load)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [load]);

  const fmtTime = (iso: string | null) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return language === 'ar' ? 'الآن' : 'now';
    if (mins < 60) return language === 'ar' ? `${mins} د` : `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return language === 'ar' ? `${hrs} س` : `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return language === 'ar' ? `${days} ي` : `${days}d`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
          <Text style={styles.backArrow}>{rtl ? '›' : '‹'}</Text>
        </TouchableOpacity>
        <Text style={[typography.heading, { color: colors.brown, fontFamily: `${font}Bold` }]}>
          {t('chatTitle')}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.emptyWrap}>
          <MessageCircle size={44} color={colors.brownMuted} />
          <Text style={[typography.body, { color: colors.brownMuted, marginTop: spacing.md, textAlign: 'center', fontFamily: `${font}Regular` }]}>
            {t('noMessages')}
          </Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }} showsVerticalScrollIndicator={false}>
          {rows.map((row) => (
            <TouchableOpacity
              key={row.id}
              style={styles.convoCard}
              onPress={() => router.push({
                pathname: '/chat',
                params: { conversationId: row.id, otherUserId: row.other_user_id },
              })}
              activeOpacity={0.7}
            >
              {row.other_user?.avatar_url ? <Image source={{ uri: row.other_user.avatar_url }} style={styles.convoAvatar} /> : <View style={styles.convoAvatar}><Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>{row.other_user?.full_name?.charAt(0).toUpperCase() ?? '?'}</Text></View>}

              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]} numberOfLines={1}>
                  {row.other_user?.full_name ?? (language === 'ar' ? 'مستخدم SHARek' : 'SHARek user')}
                </Text>
                {(row.other_user?.contributor_level ?? 0) > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <AchievementBadgeMini level={row.other_user?.contributor_level ?? 0} size={13} />
                  </View>
                )}
                <View style={styles.convoFoodRow}>
                  <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]} numberOfLines={1}>
                    {row.last_message?.body ?? t('noMessages')}
                  </Text>
                </View>
              </View>

              <View style={styles.convoRight}>
                <Text style={[typography.micro, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                  {fmtTime(row.last_message?.created_at ?? row.last_message_at)}
                </Text>
                {row.unread_count > 0 ? (
                  <View style={styles.unreadBadge}>
                    <Text style={[typography.micro, { color: colors.white, fontFamily: `${font}Bold` }]}>
                      {row.unread_count}
                    </Text>
                  </View>
                ) : (
                  <Send size={16} color={colors.brownMuted} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderBottomWidth: 1.5, borderColor: colors.border,
  },
  backBtn: {
    width: 46, height: 46, borderRadius: 23,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2, borderColor: colors.primary,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1, shadowRadius: 8, elevation: 4,
  },
  backArrow: {
    color: colors.brown,
    fontSize: 38,
    lineHeight: 40,
    fontWeight: '800',
    marginTop: -3,
  },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  convoCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1.5, borderColor: colors.border,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  convoAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  convoFoodRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  convoFoodImg: { width: 18, height: 18, borderRadius: 4 },
  convoRight: { alignItems: 'center', gap: 4 },
  unreadBadge: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.coral,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
  },
});

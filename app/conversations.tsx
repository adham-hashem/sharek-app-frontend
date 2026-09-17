import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, Image,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { supabase, FoodDonation, Profile } from '@/lib/supabase';
import {
  ChevronLeft, MessageCircle, UtensilsCrossed, Send,
} from 'lucide-react-native';
import { AchievementBadgeMini } from '@/components/AchievementBadge';
import { getPrimaryFoodImage } from '@/lib/foodImages';

interface ConversationRow {
  donation: FoodDonation;
  otherUser: Profile;
  unreadCount: number;
  lastMessageAt: string | null;
}

export default function ConversationsScreen() {
  const { t, language, user } = useAuth();
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';
  const rtl = language === 'ar';

  const load = useCallback(async () => {
    if (!user) return;

    const { data: ownClaims } = await supabase
      .from('food_claims')
      .select('*, food_donation:food_donations(*)')
      .eq('claimer_id', user.id)
      .order('created_at', { ascending: false });

    const { data: ownDonations } = await supabase
      .from('food_donations')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const donationIds = (ownDonations ?? []).map((donation) => donation.id);
    const { data: donorClaims } = donationIds.length
      ? await supabase
        .from('food_claims')
        .select('*, food_donation:food_donations(*)')
        .in('food_donation_id', donationIds)
        .order('created_at', { ascending: false })
      : { data: [] };

    const claims = [...(ownClaims ?? []), ...(donorClaims ?? [])]
      .filter((claim, index, all) => all.findIndex((candidate) => candidate.id === claim.id) === index)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (!claims || claims.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const seen = new Set<string>();
    const convos: ConversationRow[] = [];

    for (const claim of claims) {
      const donation = claim.food_donation as unknown as FoodDonation;
      if (!donation) continue;
      const otherId = claim.claimer_id === user.id ? donation.user_id : claim.claimer_id;
      const key = `${donation.id}_${otherId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const { data: profile } = await supabase
        .from('public_profiles')
        .select('*')
        .eq('id', otherId)
        .maybeSingle();

      const { count: unread } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('food_donation_id', donation.id)
        .eq('recipient_id', user.id)
        .is('read_at', null);

      const { data: lastMsg } = await supabase
        .from('messages')
        .select('created_at')
        .eq('food_donation_id', donation.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // A profile can be unavailable briefly (deleted account, RLS, or a
      // partially-created profile). Conversations must remain usable anyway.
      const safeProfile = (profile as Profile | null) ?? ({
        id: otherId,
        full_name: language === 'ar' ? 'مستخدم SHARek' : 'SHARek user',
        email: '', role: 'skipped', language, phone: '', country: '', currency: 'USD',
        avatar_url: null, rating: 0, meals_helped: 0, meals_received: 0,
        contributor_level: 0, is_verified: false, verified_at: null, is_admin: false,
        religion: null, created_at: '', updated_at: '', mode: null,
      } as Profile);

      convos.push({
        donation,
        otherUser: safeProfile,
        unreadCount: unread ?? 0,
        lastMessageAt: lastMsg?.created_at ?? claim.created_at,
      });
    }

    convos.sort((a, b) => {
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return tb - ta;
    });

    setRows(convos);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    const sub = supabase
      .channel('conversations_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_claims' }, load)
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
              key={`${row.donation.id}_${row.otherUser.id}`}
              style={styles.convoCard}
              onPress={() => router.push({
                pathname: '/chat',
                params: { donationId: row.donation.id, otherUserId: row.otherUser.id },
              })}
              activeOpacity={0.7}
            >
              <View style={styles.convoAvatar}>
                <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>
                  {row.otherUser.full_name?.charAt(0).toUpperCase() ?? '?'}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]} numberOfLines={1}>
                  {row.otherUser.full_name ?? '...'}
                </Text>
                {(row.otherUser.contributor_level ?? 0) > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <AchievementBadgeMini level={row.otherUser.contributor_level ?? 0} size={13} />
                  </View>
                )}
                <View style={styles.convoFoodRow}>
                  {getPrimaryFoodImage(row.donation) ? (
                    <Image source={{ uri: getPrimaryFoodImage(row.donation)! }} style={styles.convoFoodImg} />
                  ) : (
                    <View style={[styles.convoFoodImg, { backgroundColor: colors.greenBg, justifyContent: 'center', alignItems: 'center' }]}>
                      <UtensilsCrossed size={12} color={colors.green} />
                    </View>
                  )}
                  <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]} numberOfLines={1}>
                    {row.donation.food_name}
                  </Text>
                </View>
              </View>

              <View style={styles.convoRight}>
                <Text style={[typography.micro, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                  {fmtTime(row.lastMessageAt)}
                </Text>
                {row.unreadCount > 0 ? (
                  <View style={styles.unreadBadge}>
                    <Text style={[typography.micro, { color: colors.white, fontFamily: `${font}Bold` }]}>
                      {row.unreadCount}
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

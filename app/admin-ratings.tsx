import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { supabase, FoodRating, ACHIEVEMENT_BADGES } from '@/lib/supabase';
import {
  ChevronLeft, Star, Flag, Trash2, ShieldCheck, TrendingUp, AlertCircle,
} from 'lucide-react-native';

interface RatingWithProfiles extends FoodRating {
  rater_profile?: { full_name: string };
  rated_profile?: { full_name: string };
  food_donation?: { food_name: string };
}

export default function AdminRatingsScreen() {
  const { t, language, profile } = useAuth();
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';
  const rtl = language === 'ar';
  const isAdmin = profile?.is_admin === true;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<{ total_ratings: number; avg_rating: number; flagged_count: number; distribution: Record<string, number> } | null>(null);
  const [ratings, setRatings] = useState<RatingWithProfiles[]>([]);
  const [filter, setFilter] = useState<'all' | 'flagged'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const [{ data: statsData }, { data: ratingsData }] = await Promise.all([
      supabase.rpc('get_admin_ratings_stats'),
      supabase
        .from('food_ratings')
        .select(`
          *,
          rater_profile:rater_id(full_name),
          rated_profile:rated_user_id(full_name),
          food_donation:food_donation_id(food_name)
        `)
        .order('created_at', { ascending: false })
        .limit(200),
    ]);

    if (statsData) setStats(statsData as any);
    if (ratingsData) setRatings(ratingsData as RatingWithProfiles[]);
    setLoading(false);
    setRefreshing(false);
  }, [isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const flagReview = async (id: string, flagged: boolean) => {
    setBusyId(id);
    const { error } = await supabase.rpc('admin_flag_review', { p_rating_id: id, p_flagged: flagged });
    setBusyId(null);
    if (error) {
      Alert.alert(t('errorGeneric'));
      return;
    }
    loadData();
  };

  const deleteReview = async (id: string) => {
    Alert.alert(
      t('deleteReview'),
      t('deleteReview') + '?',
      [
        { text: t('back'), style: 'cancel' },
        {
          text: t('deleteReview'),
          style: 'destructive',
          onPress: async () => {
            setBusyId(id);
            const { error } = await supabase.rpc('admin_delete_review', { p_rating_id: id });
            setBusyId(null);
            if (error) {
              Alert.alert(t('errorGeneric'));
              return;
            }
            loadData();
          },
        },
      ],
    );
  };

  const filteredRatings = filter === 'flagged'
    ? ratings.filter(r => r.is_flagged)
    : ratings;

  const renderStars = (rating: number, size = 14) => {
    return (
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <Star
            key={n}
            size={size}
            color={n <= rating ? colors.golden : colors.border}
            fill={n <= rating ? colors.golden : 'transparent'}
            strokeWidth={2}
          />
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
            <ChevronLeft size={26} color={colors.brown} style={{ transform: [{ scaleX: rtl ? -1 : 1 }] }} />
          </TouchableOpacity>
          <Text style={[typography.heading, { color: colors.brown, fontFamily: `${font}Bold` }]}>
            {t('adminRatings')}
          </Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
            <ChevronLeft size={26} color={colors.brown} style={{ transform: [{ scaleX: rtl ? -1 : 1 }] }} />
          </TouchableOpacity>
          <Text style={[typography.heading, { color: colors.brown, fontFamily: `${font}Bold` }]}>
            {t('adminRatings')}
          </Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.loadingWrap}>
          <ShieldCheck size={48} color={colors.brownMuted} />
          <Text style={[typography.body, { color: colors.brownMuted, marginTop: spacing.md, fontFamily: `${font}Regular` }]}>
            {language === 'ar' ? 'هذه الصفحة مخصصة للأدمن فقط.' : 'This page is only available to admins.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
          <ChevronLeft size={26} color={colors.brown} style={{ transform: [{ scaleX: rtl ? -1 : 1 }] }} />
        </TouchableOpacity>
        <Text style={[typography.heading, { color: colors.brown, fontFamily: `${font}Bold` }]}>
          {t('adminRatings')}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Star size={20} color={colors.goldenDark} />
            <Text style={[typography.huge, { fontSize: 24, color: colors.brown, fontFamily: `${font}ExtraBold` }]}>
              {stats?.total_ratings ?? 0}
            </Text>
            <Text style={[typography.micro, { color: colors.brownMuted, fontFamily: `${font}Regular`, textAlign: 'center' }]}>
              {t('totalRatings')}
            </Text>
          </View>
          <View style={styles.statCard}>
            <TrendingUp size={20} color={colors.green} />
            <Text style={[typography.huge, { fontSize: 24, color: colors.brown, fontFamily: `${font}ExtraBold` }]}>
              {stats?.avg_rating ? (stats.avg_rating as number).toFixed(1) : '—'}
            </Text>
            <Text style={[typography.micro, { color: colors.brownMuted, fontFamily: `${font}Regular`, textAlign: 'center' }]}>
              {t('avgRatingAll')}
            </Text>
          </View>
          <View style={styles.statCard}>
            <AlertCircle size={20} color={colors.error} />
            <Text style={[typography.huge, { fontSize: 24, color: colors.brown, fontFamily: `${font}ExtraBold` }]}>
              {stats?.flagged_count ?? 0}
            </Text>
            <Text style={[typography.micro, { color: colors.brownMuted, fontFamily: `${font}Regular`, textAlign: 'center' }]}>
              {t('flaggedReviews')}
            </Text>
          </View>
        </View>

        {/* Rating Distribution */}
        {stats && stats.distribution && (
          <View style={styles.sectionCard}>
            <Text style={[typography.small, { color: colors.brownMuted, marginBottom: spacing.sm, fontFamily: `${font}SemiBold` }]}>
              {t('ratingDistribution')}
            </Text>
            {[5, 4, 3, 2, 1].map(n => {
              const count = stats.distribution[String(n)] ?? 0;
              const total = stats.total_ratings || 1;
              const pct = (count / total) * 100;
              return (
                <View key={n} style={styles.distRow}>
                  <Text style={[typography.small, { color: colors.brown, fontFamily: `${font}SemiBold`, width: 24 }]}>
                    {n}
                  </Text>
                  <Star size={12} color={colors.golden} fill={colors.golden} />
                  <View style={styles.distBarBg}>
                    <View style={[styles.distBarFill, { width: `${pct}%`, backgroundColor: colors.golden }]} />
                  </View>
                  <Text style={[typography.micro, { color: colors.brownMuted, fontFamily: `${font}Regular`, width: 30, textAlign: 'right' }]}>
                    {count}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Badge Requirements */}
        <View style={styles.sectionCard}>
          <Text style={[typography.small, { color: colors.brownMuted, marginBottom: spacing.sm, fontFamily: `${font}SemiBold` }]}>
            {t('adminBadges')}
          </Text>
          <View style={styles.badgeReqRow}>
            {ACHIEVEMENT_BADGES.slice(0, 5).map(b => (
              <View key={b.level} style={[styles.badgeReqCard, { backgroundColor: b.bgColor, borderColor: b.color }]}>
                <Text style={{ fontSize: 22 }}>{b.emoji}</Text>
                <Text style={[typography.micro, { color: b.color, fontFamily: `${font}Bold`, textAlign: 'center' }]}>
                  {t(b.labelKey)}
                </Text>
                <Text style={[typography.micro, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                  {b.minShares}+
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
            onPress={() => setFilter('all')}
            activeOpacity={0.7}
          >
            <Text style={[typography.small, { color: filter === 'all' ? colors.white : colors.brown, fontFamily: `${font}SemiBold` }]}>
              {t('adminReviews')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, filter === 'flagged' && styles.filterTabActive]}
            onPress={() => setFilter('flagged')}
            activeOpacity={0.7}
          >
            <Text style={[typography.small, { color: filter === 'flagged' ? colors.white : colors.brown, fontFamily: `${font}SemiBold` }]}>
              {t('flaggedReviews')} ({stats?.flagged_count ?? 0})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Ratings List */}
        {filteredRatings.length === 0 ? (
          <View style={styles.emptyState}>
            <Star size={40} color={colors.brownMuted} />
            <Text style={[typography.caption, { color: colors.brownMuted, marginTop: spacing.md, fontFamily: `${font}Regular` }]}>
              {t('noRatingsYet')}
            </Text>
          </View>
        ) : (
          <View style={styles.ratingsList}>
            {filteredRatings.map(r => (
              <View key={r.id} style={[styles.ratingCard, r.is_flagged && { borderColor: colors.error, borderWidth: 2 }]}>
                <View style={styles.ratingHeader}>
                  <View style={styles.ratingUserRow}>
                    <View style={styles.ratingAvatar}>
                      <Text style={[typography.micro, { color: colors.white, fontFamily: `${font}Bold` }]}>
                        {(r.rated_profile?.full_name ?? '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                        {t('partnerRating')}
                      </Text>
                      <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]} numberOfLines={1}>
                        {r.rated_profile?.full_name ?? '—'}
                      </Text>
                    </View>
                  </View>
                  {renderStars(r.rating, 16)}
                </View>

                {r.review ? (
                  <Text style={[typography.body, { color: colors.brownLight, marginTop: spacing.sm, fontFamily: `${font}Regular` }]}>
                    "{r.review}"
                  </Text>
                ) : null}

                <View style={styles.ratingMeta}>
                  <Text style={[typography.micro, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                    {r.rater_profile?.full_name ?? '—'} · {r.food_donation?.food_name ?? '—'}
                  </Text>
                  <Text style={[typography.micro, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </Text>
                </View>

                {r.is_flagged && (
                  <View style={styles.flaggedBanner}>
                    <Flag size={12} color={colors.error} />
                    <Text style={[typography.micro, { color: colors.error, fontFamily: `${font}Bold` }]}>
                      {t('flaggedReviews')}
                    </Text>
                  </View>
                )}

                <View style={styles.ratingActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: r.is_flagged ? colors.greenBg : colors.errorBg }]}
                    onPress={() => flagReview(r.id, !r.is_flagged)}
                    disabled={busyId === r.id}
                    activeOpacity={0.7}
                  >
                    {busyId === r.id ? (
                      <ActivityIndicator size={14} color={r.is_flagged ? colors.green : colors.error} />
                    ) : (
                      <>
                        <Flag size={14} color={r.is_flagged ? colors.green : colors.error} />
                        <Text style={[typography.micro, { color: r.is_flagged ? colors.green : colors.error, fontFamily: `${font}Bold` }]}>
                          {r.is_flagged ? t('unflagReview') : t('flagReview')}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.errorBg }]}
                    onPress={() => deleteReview(r.id)}
                    disabled={busyId === r.id}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={14} color={colors.error} />
                    <Text style={[typography.micro, { color: colors.error, fontFamily: `${font}Bold` }]}>
                      {t('deleteReview')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderBottomWidth: 1.5, borderColor: colors.border,
  },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statsGrid: {
    flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.lg,
  },
  statCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    alignItems: 'center', gap: spacing.xs, borderWidth: 1.5, borderColor: colors.border,
  },
  sectionCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    marginHorizontal: spacing.lg, marginTop: spacing.lg, borderWidth: 1.5, borderColor: colors.border,
  },
  distRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 3,
  },
  distBarBg: {
    flex: 1, height: 8, backgroundColor: colors.surfaceMuted, borderRadius: 4, overflow: 'hidden',
  },
  distBarFill: {
    height: '100%', borderRadius: 4,
  },
  badgeReqRow: {
    flexDirection: 'row', gap: spacing.xs,
  },
  badgeReqCard: {
    flex: 1, alignItems: 'center', gap: 4, borderRadius: radius.md,
    paddingHorizontal: spacing.xs, paddingVertical: spacing.sm, borderWidth: 1.5,
  },
  filterRow: {
    flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.lg,
  },
  filterTab: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt, borderWidth: 1.5, borderColor: colors.border,
  },
  filterTabActive: {
    backgroundColor: colors.primary, borderColor: colors.primary,
  },
  emptyState: {
    alignItems: 'center', paddingVertical: spacing.xxl,
  },
  ratingsList: {
    paddingHorizontal: spacing.lg, marginTop: spacing.md, gap: spacing.md,
  },
  ratingCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1.5, borderColor: colors.border,
  },
  ratingHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  ratingUserRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1,
  },
  ratingAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  ratingMeta: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm,
  },
  flaggedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm,
    backgroundColor: colors.errorBg, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  ratingActions: {
    flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
  },
});

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Clock, MapPin, Star, UtensilsCrossed } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { colors, radius, spacing, typography } from '@/lib/theme';
import { FoodDonation, Profile, supabase } from '@/lib/supabase';
import { Coords, ensureLocationPermission, getCurrentLocation, haversineKm, watchLocation } from '@/lib/location';
import { getPrimaryFoodImage, resolveFoodImages } from '@/lib/foodImages';
import { AchievementBadgeMini } from '@/components/AchievementBadge';

type CommunityMeal = FoodDonation & { owner?: Profile; distance: number | null; ratingCount: number };

function Countdown({ expiresAt, language }: { expiresAt: string; language: 'ar' | 'en' }) {
  const [, tick] = useState(0);
  useEffect(() => { const timer = setInterval(() => tick(value => value + 1), 1000); return () => clearInterval(timer); }, []);
  const seconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60);
  return <Text style={styles.metaText}>{seconds <= 0 ? (language === 'ar' ? 'منتهية' : 'Expired') : `${hours}:${String(minutes).padStart(2, '0')}`}</Text>;
}

export default function CommunityScreen() {
  const { user, profile, t, language } = useAuth();
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';
  const [location, setLocation] = useState<Coords | null>(null);
  const [meals, setMeals] = useState<CommunityMeal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('food_donations').select('*').eq('status', 'available').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(150);
    const donations = await Promise.all(((data ?? []) as FoodDonation[]).map(resolveFoodImages));
    const ownerIds = [...new Set(donations.map(item => item.user_id))];
    const [{ data: owners }, { data: ratings }, { data: profileStats }] = await Promise.all([
      ownerIds.length ? supabase.from('public_profiles').select('*').in('id', ownerIds) : Promise.resolve({ data: [] }),
      ownerIds.length ? supabase.from('public_rating_counts').select('reviewee_id,rating_count').in('reviewee_id', ownerIds) : Promise.resolve({ data: [] }),
      ownerIds.length ? supabase.from('donor_statistics').select('user_id,donated_meals,people_helped').in('user_id', ownerIds) : Promise.resolve({ data: [] }),
    ]);
    const ownerMap = new Map(((owners ?? []) as Profile[]).map(item => [item.id, item]));
    const ratingCounts = new Map((ratings ?? []).map((rating: any) => [rating.reviewee_id, Number(rating.rating_count)]));
    const stats = new Map((profileStats ?? []).map((entry: any) => [entry.user_id, entry]));
    setMeals(donations.map(item => {
      const owner = ownerMap.get(item.user_id);
      const stat = stats.get(item.user_id) as any;
      return { ...item,
        owner: owner ? { ...owner, meals_helped: Number(stat?.donated_meals ?? owner.meals_helped) } : undefined,
        distance: location ? haversineKm(location, { latitude: item.latitude, longitude: item.longitude }) : null,
        ratingCount: ratingCounts.get(item.user_id) ?? 0 };
    }));
    setLoading(false);
  }, [location?.latitude, location?.longitude]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    void (async () => {
      if (!await ensureLocationPermission()) { setLoading(false); return; }
      const initial = await getCurrentLocation(); if (initial) setLocation(initial);
      cleanup = await watchLocation(setLocation);
    })();
    return () => cleanup?.();
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase.channel('sharek_community_live').on('postgres_changes', { event: '*', schema: 'public', table: 'food_donations' }, () => { void load(); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const sorted = useMemo(() => [...meals].sort((a, b) => {
    if (a.user_id === user?.id && b.user_id !== user?.id) return -1;
    if (b.user_id === user?.id && a.user_id !== user?.id) return 1;
    return (a.distance ?? Number.MAX_VALUE) - (b.distance ?? Number.MAX_VALUE);
  }), [meals, user?.id]);

  if (!(profile?.role === 'donor' || profile?.mode === 'donor')) return null;
  return <ScrollView style={styles.container} contentContainerStyle={styles.content}>
    <Text style={[typography.heading, { color: colors.brown, fontFamily: `${font}Bold`, textAlign: 'center' }]}>{t('sharekCommunity')} 🌍</Text>
    <Text style={[typography.caption, { color: colors.brownMuted, fontFamily: `${font}Regular`, textAlign: 'center' }]}>{t('communitySubtitle')}</Text>
    {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /> : sorted.length === 0 ? <Text style={[typography.body, { color: colors.brownMuted, textAlign: 'center', marginTop: spacing.xl }]}>{t('noMealsAvailable')}</Text> : sorted.map(meal => {
      const image = getPrimaryFoodImage(meal);
      const owner = meal.owner;
      return <TouchableOpacity key={meal.id} style={styles.card} activeOpacity={0.9} onPress={() => router.push({ pathname: '/food-details' as any, params: { id: meal.id } })}>
        {image ? <Image source={{ uri: image }} style={styles.foodImage} /> : <View style={[styles.foodImage, styles.fallback]}><UtensilsCrossed size={42} color={colors.green} /></View>}
        {meal.user_id === user?.id && <View style={styles.mineBadge}><Text style={styles.mineText}>{t('myPublishedMeal')}</Text></View>}
        <View style={styles.body}>
          <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]}>{meal.food_name}</Text>
          {!!meal.description && <Text numberOfLines={1} style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>{meal.description}</Text>}
          <View style={styles.metaRow}><Text style={styles.metaText}>🍱 {meal.meals}</Text><View style={styles.meta}><MapPin size={13} color={colors.green} /><Text style={styles.metaText}>{meal.distance == null ? '—' : meal.distance < 1 ? `${Math.round(meal.distance * 1000)} ${language === 'ar' ? 'م' : 'm'}` : `${meal.distance.toFixed(1)} ${t('km')}`}</Text></View><View style={styles.meta}><Clock size={13} color={colors.goldenDark} /><Countdown expiresAt={meal.expires_at} language={language} /></View></View>
          <TouchableOpacity style={styles.ownerRow} onPress={() => router.push({ pathname: '/user-profile' as any, params: { id: meal.user_id } })}>
            {owner?.avatar_url ? <Image source={{ uri: owner.avatar_url }} style={styles.avatar} /> : <View style={[styles.avatar, styles.fallback]}><Text>{owner?.full_name?.charAt(0) ?? '?'}</Text></View>}
            <View style={{ flex: 1 }}><Text style={[typography.small, { color: colors.brown, fontFamily: `${font}Bold` }]}>{owner?.full_name ?? t('sharekHelper')}</Text><View style={styles.meta}><Star size={12} color={colors.golden} fill={colors.golden} /><Text style={styles.metaText}>{(owner?.rating ?? 0).toFixed(1)} ({meal.ratingCount})</Text>{owner && <AchievementBadgeMini level={owner.contributor_level ?? 0} size={14} />}</View><Text style={styles.metaText}>{t('peopleHelped')}: {owner?.meals_helped ?? 0}</Text></View>
            <View style={styles.status}><Text style={styles.statusText}>{t('available')}</Text></View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>;
    })}
  </ScrollView>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.lg, paddingBottom: 110, gap: spacing.md }, card: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }, foodImage: { width: '100%', height: 210 }, fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt }, mineBadge: { position: 'absolute', top: spacing.sm, left: spacing.sm, backgroundColor: colors.primary, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.pill }, mineText: { color: colors.white, fontSize: 11, fontWeight: '700' }, body: { padding: spacing.md, gap: spacing.xs }, metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, alignItems: 'center' }, meta: { flexDirection: 'row', alignItems: 'center', gap: 3 }, metaText: { color: colors.brownMuted, fontSize: 12 }, ownerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderLight }, avatar: { width: 38, height: 38, borderRadius: 19 }, status: { backgroundColor: colors.greenBg, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 }, statusText: { color: colors.greenDark, fontSize: 11, fontWeight: '700' } });

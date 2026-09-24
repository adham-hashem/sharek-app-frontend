import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Clock3, MapPin, Plus, Star, Trash2, UtensilsCrossed } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { colors, radius, spacing } from '@/lib/theme';
import { ACHIEVEMENT_BADGES, FoodDonation, Profile, supabase } from '@/lib/supabase';
import { Coords, ensureLocationPermission, getCurrentLocation, haversineKm, watchLocation } from '@/lib/location';
import { getPrimaryFoodImage, resolveFoodImages } from '@/lib/foodImages';
import { AchievementBadgeMini } from '@/components/AchievementBadge';

type Impact = { donated_meals: number; people_helped: number };
type CommunityMeal = FoodDonation & { owner?: Profile; ratingCount: number; impact?: Impact };

export default function CommunityScreen() {
  const { user, profile, t, language } = useAuth();
  const rtl = language === 'ar';
  const font = rtl ? 'Cairo-' : 'Inter-';
  const [location, setLocation] = useState<Coords | null>(null);
  const [meals, setMeals] = useState<CommunityMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [managedId, setManagedId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    const [feedResult, ownResult] = await Promise.all([
      supabase.from('food_donations').select('*').eq('status', 'available').gt('expires_at', new Date().toISOString()).gt('meals', 0).order('created_at', { ascending: false }).limit(80),
      user?.id ? supabase.from('food_donations').select('*').eq('user_id', user.id).in('status', ['available', 'claimed', 'ready_for_pickup']).order('created_at', { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    ]);
    if (feedResult.error) { setLoading(false); return; }
    const donations = [...new Map([...(feedResult.data ?? []), ...(ownResult.data ?? [])].map(item => [item.id, item])).values()] as FoodDonation[];
    const ownerIds = [...new Set(donations.map(item => item.user_id))];
    const [images, ownersResult, ratingsResult, impactResult] = await Promise.all([
      Promise.all(donations.map(async item => {
        const primary = getPrimaryFoodImage(item);
        if (!primary) return item;
        const resolved = await resolveFoodImages({ ...item, image_url: primary, image_urls: [] });
        return { ...item, image_url: resolved.image_url, image_urls: resolved.image_urls };
      })),
      ownerIds.length ? supabase.from('public_profiles').select('*').in('id', ownerIds) : Promise.resolve({ data: [] }),
      ownerIds.length ? supabase.from('public_rating_counts').select('reviewee_id,rating_count').in('reviewee_id', ownerIds) : Promise.resolve({ data: [] }),
      ownerIds.length ? supabase.from('public_donor_impact').select('user_id,donated_meals,people_helped').in('user_id', ownerIds) : Promise.resolve({ data: [] }),
    ]);
    const owners = new Map(((ownersResult.data ?? []) as Profile[]).map(item => [item.id, item]));
    const ratings = new Map(((ratingsResult.data ?? []) as { reviewee_id: string; rating_count: number }[]).map(item => [item.reviewee_id, Number(item.rating_count)]));
    const impact = new Map(((impactResult.data ?? []) as { user_id: string; donated_meals: number; people_helped: number }[]).map(item => [item.user_id, { donated_meals: Number(item.donated_meals), people_helped: Number(item.people_helped) }]));
    setMeals(images.map(item => {
      const owner = owners.get(item.user_id);
      const donorImpact = impact.get(item.user_id);
      const level = donorImpact ? [...ACHIEVEMENT_BADGES].reverse().find(b => donorImpact.donated_meals >= b.minShares)?.level ?? 0 : 0;
      return { ...item, owner: owner ? { ...owner, contributor_level: level } : undefined, ratingCount: ratings.get(item.user_id) ?? 0, impact: donorImpact };
    }));
    setLoading(false);
  }, [user?.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => {
    let active = true;
    let stop: (() => void) | undefined;
    void (async () => {
      if (!await ensureLocationPermission()) return;
      const initial = await getCurrentLocation();
      if (active && initial) setLocation(initial);
      stop = await watchLocation(coords => { if (active) setLocation(coords); });
      if (!active) stop();
    })();
    return () => { active = false; stop?.(); };
  }, []);
  useEffect(() => {
    const ticker = setInterval(() => setNow(Date.now()), 30000);
    const channel = supabase.channel('sharek_community_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_donations' }, () => { void load(); }).subscribe();
    return () => { clearInterval(ticker); void supabase.removeChannel(channel); };
  }, [load]);

  const active = useMemo(() => meals.filter(item => item.status === 'available' && item.meals > 0 && new Date(item.expires_at).getTime() > now), [meals, now]);
  const ownMeals = meals.filter(item => item.user_id === user?.id && (item.status === 'claimed' || item.status === 'ready_for_pickup' || (item.status === 'available' && item.meals > 0 && new Date(item.expires_at).getTime() > now)));
  const distance = (item: FoodDonation) => location && Number.isFinite(item.latitude) && Number.isFinite(item.longitude)
    ? haversineKm(location, { latitude: item.latitude, longitude: item.longitude }) : null;
  const nearby = active.filter(item => item.user_id !== user?.id).sort((a, b) => (distance(a) ?? Infinity) - (distance(b) ?? Infinity));
  const distanceLabel = (item: FoodDonation) => {
    const km = distance(item);
    return km == null ? (rtl ? 'المسافة غير متاحة' : 'Distance unavailable') : km < 1
      ? `${Math.round(km * 1000)} ${rtl ? 'م' : 'm'}` : `${km.toFixed(1)} ${t('km')}`;
  };
  const expiryLabel = (item: FoodDonation) => {
    const minutes = Math.max(0, Math.ceil((new Date(item.expires_at).getTime() - now) / 60000));
    return minutes < 60 ? `${minutes} ${rtl ? 'دقيقة متبقية' : 'min left'}` : `${Math.floor(minutes / 60)} ${rtl ? 'س' : 'h'} ${minutes % 60} ${rtl ? 'د' : 'm'}`;
  };

  const openMeal = (meal: FoodDonation) => router.push({ pathname: '/food-details' as never, params: { id: meal.id } });
  const openOwner = (meal: FoodDonation) => router.push({ pathname: '/user-profile' as never, params: { id: meal.user_id } });
  const removeOwnMeal = async (meal: FoodDonation) => {
    if (meal.user_id !== user?.id || meal.status !== 'available') return;
    const message = rtl ? 'هل تريد حذف عرض الوجبة؟' : 'Delete this food offer?';
    const confirmed = Platform.OS === 'web' ? window.confirm(message) : await new Promise<boolean>(resolve => Alert.alert(t('deleteMeal'), message, [
      { text: t('back'), style: 'cancel', onPress: () => resolve(false) },
      { text: t('confirmYes'), style: 'destructive', onPress: () => resolve(true) },
    ]));
    if (!confirmed) return;
    const { error } = await supabase.from('food_donations').delete().eq('id', meal.id).eq('user_id', user.id).eq('status', 'available');
    if (error) Alert.alert(t('errorGeneric'), error.message);
    else { setMeals(current => current.filter(item => item.id !== meal.id)); setManagedId(null); }
  };

  const renderMeal = (meal: CommunityMeal, mine: boolean) => {
    const image = getPrimaryFoodImage(meal);
    const owner = meal.owner;
    return <View key={meal.id} style={[styles.card, mine && styles.ownCard]}>
      <TouchableOpacity onPress={() => openMeal(meal)} activeOpacity={0.9} accessibilityRole="button">
        {image ? <Image source={{ uri: image }} style={styles.foodImage} /> : <View style={[styles.foodImage, styles.imageFallback]}><UtensilsCrossed size={42} color={colors.green} /></View>}
      </TouchableOpacity>
      {mine && <View style={[styles.ownBadge, rtl ? { right: 12 } : { left: 12 }]}><Text style={[styles.ownBadgeText, { fontFamily: `${font}Bold` }]}>{rtl ? 'وجبتك' : 'Your Meal'}</Text></View>}
      <View style={styles.cardBody}>
        <Text style={[styles.mealTitle, { fontFamily: `${font}Bold`, textAlign: rtl ? 'right' : 'left' }]}>{meal.food_name}</Text>
        {!!meal.description && <Text numberOfLines={2} style={[styles.description, { fontFamily: `${font}Regular`, textAlign: rtl ? 'right' : 'left' }]}>{meal.description}</Text>}
        <View style={[styles.metaRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          <View style={styles.availablePill}><Text style={[styles.availableText, { fontFamily: `${font}SemiBold` }]}>{meal.status === 'available' ? t('available') : meal.status === 'claimed' ? (rtl ? 'محجوزة' : 'Reserved') : (rtl ? 'جاهزة للاستلام' : 'Ready for pickup')}</Text></View>
          <Text style={[styles.metaText, { fontFamily: `${font}Regular` }]}>{meal.meals} {t('meals')}</Text>
          {meal.status === 'available' && <View style={styles.metaItem}><Clock3 size={14} color={colors.goldenDark} /><Text style={[styles.metaText, { fontFamily: `${font}Regular` }]}>{expiryLabel(meal)}</Text></View>}
        </View>
        <Text style={[styles.expiryTime, { fontFamily: `${font}Regular`, textAlign: rtl ? 'right' : 'left' }]}>{rtl ? 'ينتهي' : 'Expires'}: {new Date(meal.expires_at).toLocaleString(rtl ? 'ar-AE' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</Text>
        {!mine && <TouchableOpacity style={[styles.ownerRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]} onPress={() => openOwner(meal)} accessibilityRole="button" activeOpacity={0.75}>
          {owner?.avatar_url ? <Image source={{ uri: owner.avatar_url }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarInitial}>{owner?.full_name?.charAt(0) ?? '?'}</Text></View>}
          <View style={styles.ownerInfo}>
            <Text numberOfLines={1} style={[styles.ownerName, { fontFamily: `${font}SemiBold`, textAlign: rtl ? 'right' : 'left' }]}>{owner?.full_name ?? t('sharekHelper')}</Text>
            <View style={styles.ownerMeta}><Star size={13} color={colors.goldenDark} fill={colors.golden} /><Text style={styles.metaText}>{(owner?.rating ?? 0).toFixed(1)} ({meal.ratingCount})</Text><AchievementBadgeMini level={owner?.contributor_level ?? 0} size={15} /></View>
          </View>
          <View style={styles.metaItem}><MapPin size={14} color={colors.primary} /><Text style={[styles.distanceText, { fontFamily: `${font}SemiBold` }]}>{distanceLabel(meal)}</Text></View>
        </TouchableOpacity>}
        <TouchableOpacity style={[styles.action, mine ? styles.ownAction : styles.viewAction]} onPress={() => mine ? setManagedId(current => current === meal.id ? null : meal.id) : openMeal(meal)} accessibilityRole="button">
          <Text style={[styles.actionText, { color: mine ? colors.primaryDark : colors.white, fontFamily: `${font}Bold` }]}>{mine ? (rtl ? 'إدارة الوجبة' : 'Manage Meal') : (rtl ? 'عرض الوجبة' : 'View Meal')}</Text>
        </TouchableOpacity>
        {mine && managedId === meal.id && <View style={[styles.manageActions, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity onPress={() => openMeal(meal)} style={styles.manageButton}><Text style={[styles.manageText, { fontFamily: `${font}SemiBold` }]}>{rtl ? 'عرض التفاصيل' : 'View details'}</Text></TouchableOpacity>
          {meal.status === 'available' && <TouchableOpacity onPress={() => { void removeOwnMeal(meal); }} style={styles.manageButton}><Trash2 size={15} color={colors.coralDark} /><Text style={[styles.manageText, { color: colors.coralDark, fontFamily: `${font}SemiBold` }]}>{t('deleteMeal')}</Text></TouchableOpacity>}
        </View>}
      </View>
    </View>;
  };

  if (!(profile?.role === 'donor' || profile?.mode === 'donor')) return null;
  return <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
    <View style={[styles.header, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
      <View style={styles.headerCopy}>
        <Text style={[styles.title, { fontFamily: `${font}Bold`, textAlign: rtl ? 'right' : 'left' }]}>{t('sharekCommunity')} 🌍</Text>
        <Text style={[styles.subtitle, { fontFamily: `${font}Regular`, textAlign: rtl ? 'right' : 'left' }]}>{rtl ? 'وجبتك أولًا، ثم الوجبات المتاحة بالقرب منك' : 'Your meal first, then available meals near you'}</Text>
      </View>
      <TouchableOpacity style={styles.shareButton} onPress={() => router.push('/(tabs)/donate')} accessibilityRole="button"><Plus size={17} color={colors.primaryDark} /><Text style={[styles.shareText, { fontFamily: `${font}SemiBold` }]}>{rtl ? 'شارك وجبة' : 'Share a Meal'}</Text></TouchableOpacity>
    </View>
    {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : <>
      <Text style={[styles.sectionTitle, { fontFamily: `${font}Bold`, textAlign: rtl ? 'right' : 'left' }]}>{rtl ? 'وجبتك الحالية' : 'Your Active Meal'}</Text>
      {ownMeals.length ? ownMeals.map(item => renderMeal(item, true)) : <View style={styles.emptyOwn}><UtensilsCrossed size={24} color={colors.green} /><Text style={[styles.emptyText, { fontFamily: `${font}Regular` }]}>{rtl ? 'لا توجد لديك وجبة نشطة الآن' : 'You have no active meal right now'}</Text><TouchableOpacity onPress={() => router.push('/(tabs)/donate')}><Text style={[styles.emptyAction, { fontFamily: `${font}SemiBold` }]}>{rtl ? '+ شارك وجبة' : '+ Share a Meal'}</Text></TouchableOpacity></View>}
      <Text style={[styles.sectionTitle, { fontFamily: `${font}Bold`, textAlign: rtl ? 'right' : 'left', marginTop: spacing.lg }]}>{rtl ? 'وجبات قريبة منك' : 'Meals Near You'}</Text>
      {!location && <Text style={[styles.locationHint, { fontFamily: `${font}Regular`, textAlign: rtl ? 'right' : 'left' }]}>{rtl ? 'اسمح بالموقع لترتيب الوجبات حسب المسافة.' : 'Allow location to sort meals by distance.'}</Text>}
      {nearby.length ? nearby.map(item => renderMeal(item, false)) : <View style={styles.emptyNearby}><UtensilsCrossed size={33} color={colors.green} /><Text style={[styles.emptyText, { fontFamily: `${font}Regular` }]}>{rtl ? 'لا توجد وجبات متاحة بالقرب منك الآن' : 'No meals available near you right now'}</Text><TouchableOpacity onPress={() => router.push('/(tabs)/donate')} style={styles.emptyShare}><Plus size={16} color={colors.white} /><Text style={[styles.emptyShareText, { fontFamily: `${font}SemiBold` }]}>{rtl ? 'شارك وجبة' : 'Share a Meal'}</Text></TouchableOpacity></View>}
    </>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFCF8' }, content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: spacing.lg, paddingBottom: 115, gap: spacing.md },
  header: { alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm }, headerCopy: { flex: 1 },
  title: { color: colors.brown, fontSize: 22, lineHeight: 34 }, subtitle: { color: colors.brownMuted, fontSize: 12, lineHeight: 20, marginTop: 2 },
  shareButton: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: spacing.sm, minHeight: 36 }, shareText: { color: colors.primaryDark, fontSize: 11 },
  sectionTitle: { color: colors.brown, fontSize: 17, lineHeight: 26 }, loading: { marginTop: spacing.xl },
  card: { backgroundColor: colors.white, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderLight, shadowColor: colors.brown, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 2 },
  ownCard: { borderColor: '#C5E8CF', backgroundColor: '#FCFFFD' }, foodImage: { width: '100%', height: 218 }, imageFallback: { backgroundColor: colors.greenBg, alignItems: 'center', justifyContent: 'center' },
  ownBadge: { position: 'absolute', top: 12, backgroundColor: colors.primary, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.pill }, ownBadgeText: { color: colors.white, fontSize: 11 },
  cardBody: { padding: spacing.md, gap: spacing.sm }, mealTitle: { color: colors.brown, fontSize: 18, lineHeight: 28 }, description: { color: colors.brownMuted, fontSize: 12, lineHeight: 20 },
  metaRow: { alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm }, availablePill: { backgroundColor: colors.greenBg, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 }, availableText: { color: colors.greenDark, fontSize: 11 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 }, metaText: { color: colors.brownMuted, fontSize: 11 }, expiryTime: { color: colors.brownMuted, fontSize: 11 },
  ownerRow: { alignItems: 'center', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight, paddingTop: spacing.sm }, avatar: { width: 39, height: 39, borderRadius: 20 }, avatarFallback: { backgroundColor: colors.greenBg, alignItems: 'center', justifyContent: 'center' }, avatarInitial: { color: colors.greenDark }, ownerInfo: { flex: 1 }, ownerName: { color: colors.brown, fontSize: 12 }, ownerMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }, distanceText: { color: colors.primaryDark, fontSize: 11 },
  action: { minHeight: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs }, ownAction: { backgroundColor: colors.surfaceAlt }, viewAction: { backgroundColor: colors.primary }, actionText: { fontSize: 13 },
  manageActions: { gap: spacing.sm }, manageButton: { flex: 1, minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: radius.md, backgroundColor: colors.white }, manageText: { color: colors.brown, fontSize: 12 },
  emptyOwn: { minHeight: 104, borderRadius: radius.lg, backgroundColor: colors.greenBg, alignItems: 'center', justifyContent: 'center', gap: 5, padding: spacing.md }, emptyNearby: { minHeight: 170, borderRadius: radius.lg, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg }, emptyText: { color: colors.brownMuted, fontSize: 12, textAlign: 'center' }, emptyAction: { color: colors.primaryDark, fontSize: 12 }, emptyShare: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: spacing.md, minHeight: 36 }, emptyShareText: { color: colors.white, fontSize: 12 }, locationHint: { color: colors.brownMuted, fontSize: 11 },
});

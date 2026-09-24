import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, MapPin, MessageCircle, Star, UtensilsCrossed } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { ACHIEVEMENT_BADGES, FoodDonation, Profile, supabase } from '@/lib/supabase';
import { Coords, ensureLocationPermission, getCurrentLocation, haversineKm, watchLocation } from '@/lib/location';
import { getPrimaryFoodImage, resolveFoodImages } from '@/lib/foodImages';
import { AllBadgesRow, AchievementBadgeDisplay } from '@/components/AchievementBadge';
import { colors, radius, spacing } from '@/lib/theme';

type PublicImpact = { donated_meals: number; people_helped: number };

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { language, t, user } = useAuth();
  const rtl = language === 'ar';
  const font = rtl ? 'Cairo-' : 'Inter-';
  const [person, setPerson] = useState<Profile | null>(null);
  const [impact, setImpact] = useState<PublicImpact | null>(null);
  const [ratingCount, setRatingCount] = useState(0);
  const [meals, setMeals] = useState<FoodDonation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [location, setLocation] = useState<Coords | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    if (!id) return;
    const [profileResult, impactResult, ratingResult, mealResult] = await Promise.all([
      supabase.from('public_profiles').select('*').eq('id', id).maybeSingle(),
      supabase.from('public_donor_impact').select('donated_meals,people_helped').eq('user_id', id).maybeSingle(),
      supabase.from('public_rating_counts').select('rating_count').eq('reviewee_id', id).maybeSingle(),
      supabase.from('food_donations').select('*').eq('user_id', id).eq('status', 'available').gt('expires_at', new Date().toISOString()).gt('meals', 0).order('created_at', { ascending: false }).limit(24),
    ]);
    setPerson(profileResult.data as Profile | null);
    setImpact(impactResult.data ? { donated_meals: Number(impactResult.data.donated_meals), people_helped: Number(impactResult.data.people_helped) } : null);
    setRatingCount(Number(ratingResult.data?.rating_count ?? 0));
    setMeals(await Promise.all(((mealResult.data ?? []) as FoodDonation[]).map(async item => {
      const image = getPrimaryFoodImage(item);
      if (!image) return item;
      const resolved = await resolveFoodImages({ ...item, image_url: image, image_urls: [] });
      return { ...item, image_url: resolved.image_url, image_urls: resolved.image_urls };
    })));
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!id || !user?.id || id === user.id) return;
    const [a, b] = [id, user.id].sort();
    void supabase.from('conversations').select('id').eq('user_a', a).eq('user_b', b).maybeSingle()
      .then(({ data }) => setConversationId(data?.id ?? null));
  }, [id, user?.id]);
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
    const timer = setInterval(() => setNow(Date.now()), 30000);
    const channel = supabase.channel(`public_provider_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_donations', filter: `user_id=eq.${id}` }, () => { void load(); }).subscribe();
    return () => { clearInterval(timer); void supabase.removeChannel(channel); };
  }, [id, load]);

  const activeMeals = useMemo(() => meals.filter(item => item.status === 'available' && item.meals > 0 && new Date(item.expires_at).getTime() > now), [meals, now]);
  const nearestDistance = location && activeMeals.length ? Math.min(...activeMeals.map(item => haversineKm(location, { latitude: item.latitude, longitude: item.longitude }))) : null;
  const level = impact ? [...ACHIEVEMENT_BADGES].reverse().find(b => impact.donated_meals >= b.minShares)?.level ?? 0 : 0;

  const openChat = async () => {
    if (!id || !user?.id || id === user.id) return;
    if (conversationId) {
      router.push({ pathname: '/chat', params: { conversationId, otherUserId: id } });
      return;
    }
    const activeOffer = activeMeals[0];
    if (activeOffer) {
      const { data: createdId, error } = await supabase.rpc('ensure_conversation', { p_other: id, p_food: activeOffer.id, p_request: null });
      if (!error && createdId) {
        setConversationId(createdId);
        router.push({ pathname: '/chat', params: { conversationId: createdId, otherUserId: id } });
        return;
      }
    }
    const message = rtl ? 'يمكنك مراسلة صاحب وجبة متاحة أو شخص تواصلت معه بعد الحجز.' : 'You can message the owner of an available meal or someone you connected with after a reservation.';
    if (Platform.OS === 'web') window.alert(message);
    else Alert.alert(rtl ? 'المحادثة غير متاحة بعد' : 'Chat is not available yet', message);
  };

  return <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
    <View style={[styles.header, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel={rtl ? 'رجوع' : 'Back'}>
        {rtl ? <ChevronRight size={21} color={colors.brown} /> : <ChevronLeft size={21} color={colors.brown} />}
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { fontFamily: `${font}Bold` }]}>{t('profile')}</Text>
    </View>
    {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : !person ?
      <Text style={[styles.empty, { fontFamily: `${font}Regular` }]}>{rtl ? 'تعذر عرض هذا الملف الشخصي' : 'This profile is unavailable'}</Text> :
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.identity}>
          {person.avatar_url ? <Image source={{ uri: person.avatar_url }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.initial}>{person.full_name?.charAt(0) ?? '?'}</Text></View>}
          <Text style={[styles.name, { fontFamily: `${font}Bold` }]}>{person.full_name}</Text>
          <View style={styles.rating}><Star size={17} color={colors.goldenDark} fill={colors.golden} /><Text style={[styles.ratingText, { fontFamily: `${font}SemiBold` }]}>{Number(person.rating ?? 0).toFixed(1)} ({ratingCount})</Text></View>
          <AchievementBadgeDisplay level={level} language={language} t={t} />
          {nearestDistance != null && <View style={styles.distance}><MapPin size={15} color={colors.primary} /><Text style={[styles.distanceText, { fontFamily: `${font}Regular` }]}>{rtl ? 'أقرب نقطة استلام' : 'Nearest pickup point'} · {nearestDistance < 1 ? `${Math.round(nearestDistance * 1000)} ${rtl ? 'م' : 'm'}` : `${nearestDistance.toFixed(1)} ${t('km')}`}</Text></View>}
          {person.id !== user?.id && <TouchableOpacity style={styles.chatButton} onPress={openChat} accessibilityRole="button"><MessageCircle size={18} color={colors.white} /><Text style={[styles.chatText, { fontFamily: `${font}Bold` }]}>{rtl ? 'إرسال رسالة' : 'Send Message'}</Text></TouchableOpacity>}
        </View>
        <View style={[styles.stats, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          <View style={styles.stat}><Text style={[styles.statNumber, { fontFamily: `${font}Bold` }]}>{impact?.donated_meals ?? '—'}</Text><Text style={[styles.statLabel, { fontFamily: `${font}Regular` }]}>{rtl ? 'وجبات تمت مشاركتها' : 'Meals shared'}</Text></View>
          <View style={styles.stat}><Text style={[styles.statNumber, { fontFamily: `${font}Bold` }]}>{impact?.people_helped ?? '—'}</Text><Text style={[styles.statLabel, { fontFamily: `${font}Regular` }]}>{t('peopleHelped')}</Text></View>
        </View>
        <Text style={[styles.sectionTitle, { fontFamily: `${font}Bold`, textAlign: rtl ? 'right' : 'left' }]}>{rtl ? 'الأوسمة والإنجازات' : 'Badges & Achievements'}</Text>
        <AllBadgesRow level={level} language={language} t={t} />
        <Text style={[styles.sectionTitle, { fontFamily: `${font}Bold`, textAlign: rtl ? 'right' : 'left' }]}>{rtl ? 'الوجبات المتاحة حاليًا' : 'Currently Available Meals'}</Text>
        {activeMeals.length ? activeMeals.map(meal => <TouchableOpacity key={meal.id} style={[styles.mealRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]} onPress={() => router.push({ pathname: '/food-details' as never, params: { id: meal.id } })} accessibilityRole="button">
          {getPrimaryFoodImage(meal) ? <Image source={{ uri: getPrimaryFoodImage(meal)! }} style={styles.mealImage} /> : <View style={[styles.mealImage, styles.mealFallback]}><UtensilsCrossed size={23} color={colors.green} /></View>}
          <View style={styles.mealCopy}><Text numberOfLines={1} style={[styles.mealName, { fontFamily: `${font}SemiBold`, textAlign: rtl ? 'right' : 'left' }]}>{meal.food_name}</Text><Text style={[styles.mealMeta, { fontFamily: `${font}Regular`, textAlign: rtl ? 'right' : 'left' }]}>{meal.meals} {t('meals')} · {t('available')}</Text></View>
        </TouchableOpacity>) : <Text style={[styles.empty, { fontFamily: `${font}Regular` }]}>{rtl ? 'لا توجد وجبات متاحة الآن' : 'No meals available right now'}</Text>}
      </ScrollView>}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFCF8' }, header: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, minHeight: 56 }, back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt }, headerTitle: { color: colors.brown, fontSize: 17 }, loading: { marginTop: spacing.xl }, content: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  identity: { alignItems: 'center', gap: spacing.sm, backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg }, avatar: { width: 96, height: 96, borderRadius: 48 }, avatarFallback: { backgroundColor: colors.greenBg, alignItems: 'center', justifyContent: 'center' }, initial: { color: colors.greenDark, fontSize: 34 }, name: { color: colors.brown, fontSize: 21, textAlign: 'center' }, rating: { flexDirection: 'row', alignItems: 'center', gap: 4 }, ratingText: { color: colors.brown, fontSize: 13 }, distance: { flexDirection: 'row', alignItems: 'center', gap: 4 }, distanceText: { color: colors.brownMuted, fontSize: 12 }, chatButton: { minHeight: 45, width: '100%', borderRadius: radius.md, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm }, chatText: { color: colors.white, fontSize: 13 },
  stats: { gap: spacing.sm }, stat: { flex: 1, minHeight: 86, borderRadius: radius.lg, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', gap: 3, padding: spacing.sm }, statNumber: { color: colors.greenDark, fontSize: 20 }, statLabel: { color: colors.brownMuted, fontSize: 11, textAlign: 'center' }, sectionTitle: { color: colors.brown, fontSize: 16, marginTop: spacing.sm },
  mealRow: { alignItems: 'center', gap: spacing.sm, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.sm }, mealImage: { width: 62, height: 62, borderRadius: radius.md }, mealFallback: { backgroundColor: colors.greenBg, alignItems: 'center', justifyContent: 'center' }, mealCopy: { flex: 1 }, mealName: { color: colors.brown, fontSize: 13 }, mealMeta: { color: colors.brownMuted, fontSize: 11, marginTop: 4 }, empty: { color: colors.brownMuted, fontSize: 13, textAlign: 'center', padding: spacing.lg },
});

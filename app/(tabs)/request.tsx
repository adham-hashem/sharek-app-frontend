import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  StyleSheet, View, Text, ScrollView, ActivityIndicator,
  TouchableOpacity, Alert, Dimensions, Platform, Image, Modal, TextInput,
} from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';
import {
  Heart, MapPin, UtensilsCrossed, Clock, CheckCircle2, X,
  Navigation, Star, Bell, Search, PackageCheck,
  MessageCircle, ChevronLeft, XCircle, AlertCircle,
} from 'lucide-react-native';
import { ensureLocationPermission, getCurrentLocation, haversineKm, Coords } from '@/lib/location';
import { supabase, FoodDonation, Profile } from '@/lib/supabase';
import { SuggestedMeals } from '@/components/SuggestedMeals';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { router } from 'expo-router';
import { apiFetch, apiPost } from '@/lib/api';
import { createNotification } from '@/lib/notifications';
import { getFoodImages, getPrimaryFoodImage, resolveFoodImages } from '@/lib/foodImages';
import { playInteractionSound } from '@/lib/sound';

const AVATAR_COLORS = ['#F7564C', '#1F7A45', '#F9A825', '#6B4F3A', '#2E6FB0', '#8E44AD'];
type NearbyMapItem = {
  item_type: 'request' | 'food';
  item_id: string;
  user_id?: string;
  title?: string;
  meals?: number;
  latitude?: number;
  longitude?: number;
  expires_at?: string | null;
  created_at?: string;
};

type NeedyStage = 'browsing' | 'claimed';

interface MealWithProfile extends FoodDonation {
  donor_profile?: Profile;
  distance_km: number | null;
}

function LiveCountdown({ iso, lang, style, onExpire }: { iso: string; lang: 'ar' | 'en'; style?: any; onExpire?: () => void }) {
  const [, setTick] = useState(0);
  const expired = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = new Date(iso).getTime() - Date.now();

  useEffect(() => {
    if (diff <= 0 && !expired.current) {
      expired.current = true;
      onExpire?.();
    }
  }, [diff, onExpire]);

  if (diff <= 0) {
    return <Text style={style}>{lang === 'ar' ? 'منتهي' : 'Expired'}</Text>;
  }
  const totalSec = Math.floor(diff / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const label = hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
  return <Text style={style}>{label}</Text>;
}

function mapItemToFoodDonation(item: NearbyMapItem): FoodDonation {
  const now = new Date().toISOString();
  const expiresAt = item.expires_at ?? new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return {
    id: item.item_id,
    user_id: item.user_id ?? '',
    food_name: item.title || '',
    description: '',
    image_url: null,
    meals: item.meals ?? 1,
    pickup_start: item.created_at ?? now,
    pickup_end: expiresAt,
    expires_at: expiresAt,
    status: 'available',
    latitude: item.latitude ?? 0,
    longitude: item.longitude ?? 0,
    claimer_lat: null,
    claimer_lng: null,
    claimer_location_updated_at: null,
    donor_lat: null,
    donor_lng: null,
    donor_location_updated_at: null,
    created_at: item.created_at ?? now,
    updated_at: item.created_at ?? now,
    food_type: null,
    prepared_at: null,
    storage_method: null,
    allergens: null,
  };
}

export default function RequestScreen() {
  const { loading, profile } = useAuth();
  const accountMode = profile?.role === 'needer'
    ? 'needer'
    : profile?.role === 'donor'
      ? 'donor'
      : profile?.mode;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (accountMode === 'needer') {
    return <NeedyFlow />;
  }

  return <DonorView />;
}

function DonorView() {
  const { t, language } = useAuth();
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';
  const [location, setLocation] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(true);

  useEffect(() => {
    (async () => {
      const ok = await ensureLocationPermission();
      if (ok) {
        const coords = await getCurrentLocation();
        if (coords) setLocation(coords);
      }
      setLocating(false);
    })();
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: spacing.xxl + 60 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCard}>
          <View style={[styles.headerIcon, { backgroundColor: colors.coral }]}>
            <Heart size={28} color={colors.white} />
          </View>
          <Text style={[typography.heading, { color: colors.brown, fontFamily: `${font}Bold` }]}>
            {t('nearbyRequests')}
          </Text>
          <Text style={[typography.caption, { color: colors.brownMuted, fontFamily: `${font}Regular`, marginTop: 2 }]}>
            {t('nearbyRequestsSub')}
          </Text>
        </View>

        {locating && (
          <View style={styles.locatingBox}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
              {t('locating')}...
            </Text>
          </View>
        )}

        <SuggestedMeals location={location} showHeader={false} />
      </ScrollView>
    </View>
  );
}

function NeedyFlow() {
  const { t, language, user } = useAuth();
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';

  const [stage, setStage] = useState<NeedyStage>('browsing');
  const [location, setLocation] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(true);
  const [meals, setMeals] = useState<MealWithProfile[]>([]);
  const [expiredIds, setExpiredIds] = useState<Set<string>>(new Set());
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [activeClaims, setActiveClaims] = useState<FoodDonation[]>([]);
  const [selectedMeal, setSelectedMeal] = useState<MealWithProfile | null>(null);
  const [requestModal, setRequestModal] = useState(false);
  const [requestMeals, setRequestMeals] = useState('1');
  const [requestBusy, setRequestBusy] = useState(false);

  const distText = useCallback((dist: number | null) => {
    if (dist === null) return '—';
    if (dist < 1) return `${Math.round(dist * 1000)} ${language === 'ar' ? 'م' : 'm'}`;
    return `${dist.toFixed(1)} ${t('km')}`;
  }, [language, t]);

  const formatPickupTime = useCallback((iso: string) => {
    const d = new Date(iso);
    let h = d.getHours();
    const m = d.getMinutes();
    const period = language === 'ar' ? (h >= 12 ? 'م' : 'ص') : (h >= 12 ? 'PM' : 'AM');
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, '0')} ${period}`;
  }, [language]);

  useEffect(() => {
    (async () => {
      const ok = await ensureLocationPermission();
      if (ok) {
        const coords = await getCurrentLocation();
        if (coords) setLocation(coords);
      }
      setLocating(false);
    })();
  }, []);

  const loadMeals = useCallback(async () => {
    if (!user) return;
    if (!location) {
      setMeals([]);
      return;
    }

    let donations: FoodDonation[] = [];
    try {
      const { items } = await apiFetch<{ items: NearbyMapItem[] }>(
        `/v1/map/nearby?latitude=${encodeURIComponent(Number(location.latitude.toFixed(3)))}&longitude=${encodeURIComponent(Number(location.longitude.toFixed(3)))}&radius_km=50`,
      );
      const foodIds = items.filter((item) => item.item_type === 'food').map((item) => item.item_id);
      if (foodIds.length > 0) {
        const fallback = items.filter((item) => item.item_type === 'food').map(mapItemToFoodDonation);
        const { data, error } = await supabase.rpc('get_nearby_food_details', { p_ids: foodIds });
        donations = error || !data?.length ? fallback : (data as FoodDonation[]);
        const { data: sourceRows } = await supabase.from('food_donations').select('*').in('id', foodIds);
        const sourceMap = new Map(((sourceRows ?? []) as FoodDonation[]).map(row => [row.id, row]));
        donations = donations.map(donation => ({ ...sourceMap.get(donation.id), ...donation, image_url: donation.image_url ?? sourceMap.get(donation.id)?.image_url ?? null, image_urls: donation.image_urls ?? sourceMap.get(donation.id)?.image_urls ?? null }));
      }
    } catch {
      const { data } = await supabase
        .from('food_donations')
        .select('*')
        .eq('status', 'available')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(50);
      donations = (data ?? []) as FoodDonation[];
    }

    // Keep /request consistent with the home map even when the nearby-items
    // endpoint or its detail RPC returns no rows. Filter the same live table
    // locally by distance so a visible map meal is never missing here.
    if (donations.length === 0) {
      const { data } = await supabase
        .from('food_donations')
        .select('*')
        .eq('status', 'available')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(100);
      donations = ((data ?? []) as FoodDonation[]).filter((donation) =>
        haversineKm(location, { latitude: donation.latitude, longitude: donation.longitude }) <= 50,
      );
    }

    if (!donations || donations.length === 0) {
      setMeals([]);
      return;
    }

    const visibleDonations = await Promise.all(donations.map(resolveFoodImages));
    const donorIds = [...new Set(visibleDonations.map(d => d.user_id))];
    const profileMap = new Map<string, Profile>();
    if (donorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', donorIds);
      (profiles as Profile[] | null)?.forEach(p => profileMap.set(p.id, p));
    }

    const enriched = visibleDonations
      .filter(d => !expiredIds.has(d.id))
      .filter(d => new Date(d.expires_at).getTime() > Date.now())
      .map(d => ({
        ...d,
        donor_profile: profileMap.get(d.user_id),
        distance_km: location
          ? haversineKm(location, { latitude: d.latitude, longitude: d.longitude })
          : null,
      }) as MealWithProfile)
      .sort((a, b) => (a.distance_km ?? 9999) - (b.distance_km ?? 9999));

    setMeals(enriched);
  }, [user, location, expiredIds]);

  useEffect(() => {
    loadMeals();
    const sub = supabase
      .channel('available_meals_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_donations' }, loadMeals)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_claims' }, loadMeals)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [loadMeals]);

  const checkActiveClaims = useCallback(async () => {
    if (!user) return;
    const { data: claims } = await supabase
      .from('food_claims')
      .select('food_donation_id, status')
      .eq('claimer_id', user.id)
      .in('status', ['booked', 'ready_for_pickup']);

    if (claims && claims.length > 0) {
      const donationIds = (claims as { food_donation_id: string; status: string }[]).map(c => c.food_donation_id);
      const { data: donationData } = await supabase
        .from('food_donations')
        .select('*')
        .in('id', donationIds)
        .in('status', ['claimed', 'ready_for_pickup']);

      if (donationData && donationData.length > 0) {
        setActiveClaims(donationData as FoodDonation[]);
      }
    } else {
      setActiveClaims([]);
    }
  }, [user]);

  useEffect(() => {
    checkActiveClaims();
    const sub = supabase
      .channel('my_claims_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_claims', filter: `claimer_id=eq.${user?.id}` }, checkActiveClaims)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_donations' }, checkActiveClaims)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [checkActiveClaims, user]);

  const handleExpire = useCallback((id: string) => {
    setExpiredIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const claimMeal = async (meal: MealWithProfile) => {
    if (!user) {
      Alert.alert(t('errorGeneric'));
      return;
    }
    setClaimingId(meal.id);
    const { data, error } = await apiPost<any>(`/v1/food-donations/${meal.id}/claim`, location ? {
      latitude: location.latitude,
      longitude: location.longitude,
    } : undefined).then((result) => ({ data: result, error: null })).catch((error) => ({ data: null, error }));
    setClaimingId(null);

    if (error) {
      const msg = error.message || '';
      if (msg.includes('expired')) {
        Alert.alert(t('expired'));
      } else if (msg.includes('no longer available')) {
        Alert.alert(t('noAvailableFood'));
      } else {
        Alert.alert(t('errorGeneric'));
      }
      loadMeals();
      return;
    }

    const claim = data as { food_donation_id: string };
    const { data: fullDonation } = await supabase
      .from('food_donations')
      .select('*')
      .eq('id', claim.food_donation_id)
      .maybeSingle();

    setStage('claimed');
    loadMeals();
    checkActiveClaims();

    const donation = (fullDonation as FoodDonation) ?? meal;
    createNotification(
      donation.user_id,
      'food_claimed',
      language === 'ar' ? `تم طلب وجبتك: ${donation.food_name}` : `Your meal was claimed: ${donation.food_name}`,
      { food_donation_id: donation.id, other_user_id: user?.id },
      language,
    );
    router.push({
      pathname: '/chat',
      params: { donationId: donation.id, otherUserId: donation.user_id },
    });
  };

  const submitMealRequest = async () => {
    const mealsCount = Math.max(1, Math.min(100, Number.parseInt(requestMeals, 10) || 1));
    if (!location) { Alert.alert(t('locationError')); return; }
    setRequestBusy(true);
    try {
      await apiPost('/v1/meal-requests', { meals: mealsCount, timing: 'now', latitude: location.latitude, longitude: location.longitude });
      setRequestModal(false);
      Alert.alert(t('requestCreated'));
    } catch {
      Alert.alert(t('errorGeneric'));
    } finally { setRequestBusy(false); }
  };

  const openChatForDonation = (donation: FoodDonation) => {
    router.push({
      pathname: '/chat',
      params: { donationId: donation.id, otherUserId: donation.user_id },
    });
  };

  const confirmReceivedDonation = async (donation: FoodDonation) => {
    const confirm = async () => {
      const { error } = await supabase.rpc('confirm_food_received', { p_donation_id: donation.id });
      if (error) Alert.alert(t('errorGeneric'), error.message);
      else await checkActiveClaims();
    };
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${t('confirmReceived')}\n\n${t('confirmReceivedPrompt')}`)) await confirm();
      return;
    }
    Alert.alert(t('confirmReceived'), t('confirmReceivedPrompt'), [
      { text: t('back'), style: 'cancel' },
      { text: t('confirmYes'), onPress: () => { void confirm(); } },
    ]);
  };

  if (stage === 'claimed' && activeClaims.length > 0) {
    return (
      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: spacing.xxl + 60 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerCard}>
            <View style={[styles.headerIcon, { backgroundColor: colors.green }]}>
              <PackageCheck size={28} color={colors.white} />
            </View>
            <Text style={[typography.heading, { color: colors.brown, fontFamily: `${font}Bold` }]}>
              {t('activeMatchTitle')}
            </Text>
            <Text style={[typography.caption, { color: colors.brownMuted, fontFamily: `${font}Regular`, marginTop: 2 }]}>
              {t('offerAcceptedChat')}
            </Text>
          </View>

          {activeClaims.map((donation) => {
            const isReady = donation.status === 'ready_for_pickup';
            const primaryImage = getPrimaryFoodImage(donation);
            return (
              <View key={donation.id} style={styles.activeClaimCard}>
                {primaryImage && (
                  <Image source={{ uri: primaryImage }} style={styles.activeClaimImg} />
                )}
                <View style={styles.activeClaimBody}>
                  <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]} numberOfLines={1}>
                    {donation.food_name}
                  </Text>
                  <View style={styles.activeClaimStatusRow}>
                    <View style={[styles.activeClaimStatusBadge, { backgroundColor: isReady ? colors.greenBg : colors.warningBg }]}>
                      <Clock size={12} color={isReady ? colors.green : colors.warning} />
                      <Text style={[typography.micro, { color: isReady ? colors.greenDark : colors.warning, fontFamily: `${font}Bold` }]}>
                        {isReady ? t('readyForPickup') : t('waitingPartnerReady')}
                      </Text>
                    </View>
                    <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                      {donation.meals} {t('meals')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.activeClaimChatBtn}
                    onPress={() => openChatForDonation(donation)}
                    activeOpacity={0.8}
                  >
                    <MessageCircle size={20} color={colors.white} />
                    <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>
                      {t('openChatWithPartner')}
                    </Text>
                  </TouchableOpacity>
                  {isReady && (
                    <TouchableOpacity
                      style={styles.activeClaimConfirmBtn}
                      onPress={() => confirmReceivedDonation(donation)}
                      activeOpacity={0.8}
                    >
                      <CheckCircle2 size={20} color={colors.green} />
                      <Text style={[typography.bodyBold, { color: colors.green, fontFamily: `${font}Bold` }]}>
                        {t('confirmReceivedMatch')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}

          <TouchableOpacity
            style={styles.browseMoreBtn}
            onPress={() => setStage('browsing')}
            activeOpacity={0.7}
          >
            <Search size={18} color={colors.primary} />
            <Text style={[typography.small, { color: colors.primary, fontFamily: `${font}Bold` }]}>
              {t('availableMealsNearby')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: spacing.xxl + 60 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCard}>
          <View style={[styles.headerIcon, { backgroundColor: colors.coral }]}>
            <UtensilsCrossed size={28} color={colors.white} />
          </View>
          <Text style={[typography.heading, { color: colors.brown, fontFamily: `${font}Bold` }]}>
            {t('availableMealsNearby')}
          </Text>
            <Text style={[typography.caption, { color: colors.brownMuted, fontFamily: `${font}Regular`, marginTop: 2 }]}>
              {t('needMealSub')}
            </Text>
            <TouchableOpacity style={styles.requestMealBtn} onPress={() => setRequestModal(true)} disabled={!location}>
              <Heart size={17} color={colors.white} fill={colors.white} />
              <Text style={[typography.small, { color: colors.white, fontFamily: `${font}Bold` }]}>{t('requestMealNow')}</Text>
            </TouchableOpacity>
        </View>

        {locating && (
          <View style={styles.locatingBox}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
              {t('locating')}...
            </Text>
          </View>
        )}

        {meals.length === 0 && !locating ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceAlt }]}>
              <UtensilsCrossed size={40} color={colors.brownMuted} />
            </View>
            <Text style={[typography.body, { color: colors.brown, fontFamily: `${font}Bold`, marginTop: spacing.md }]}>
              {t('noMealsAvailable')}
            </Text>
            <Text style={[typography.caption, { color: colors.brownMuted, marginTop: spacing.xs, fontFamily: `${font}Regular`, textAlign: 'center' }]}>
              {t('noMealsAvailableDesc')}
            </Text>
          </View>
        ) : (
        <View style={styles.mealList}>
            {meals.map((meal, index) => {
              const isUrgent = new Date(meal.expires_at).getTime() - Date.now() < 3600_000;
              const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];
              const prof = meal.donor_profile;
              const isOwnFood = meal.user_id === user?.id;
              const displayName = meal.food_name || t('availableFoodFallback');
              const displayDesc = meal.description || t('partnerMeal');
              const distanceLabel = distText(meal.distance_km);
              const foodImages = getFoodImages(meal);
              const primaryImage = foodImages[0];

              return (
                  <TouchableOpacity key={meal.id} style={styles.mealCard} activeOpacity={0.92} onPress={() => { void playInteractionSound(); setSelectedMeal(meal); }}>
                  <View style={styles.mealPhotoWrap}>
                    {primaryImage ? (
                      <Image source={{ uri: primaryImage }} style={styles.mealPhoto} />
                    ) : (
                      <View style={[styles.mealPhoto, styles.mealPhotoFallback]}>
                        <UtensilsCrossed size={42} color={colors.brownMuted} />
                        <Text style={[typography.small, { color: colors.brownMuted, marginTop: spacing.xs, fontFamily: `${font}SemiBold` }]}>
                          {t('availableFoodFallback')}
                        </Text>
                      </View>
                    )}
                    {foodImages.length > 1 && (
                      <View style={styles.mealImageCountBadge}>
                        <Text style={[typography.micro, { color: colors.white, fontFamily: `${font}Bold` }]}>
                          +{foodImages.length - 1}
                        </Text>
                      </View>
                    )}
                    <View style={styles.photoTopBadges}>
                      <View style={[styles.photoBadge, { backgroundColor: isUrgent ? colors.error : colors.warning }]}>
                        <Clock size={13} color={colors.white} />
                        <Text style={[typography.small, { color: colors.white, fontFamily: `${font}Bold` }]}>
                          {t('remainingTime')}
                        </Text>
                        <LiveCountdown
                          iso={meal.expires_at}
                          lang={language}
                          onExpire={() => handleExpire(meal.id)}
                          style={[typography.small, { color: colors.white, fontFamily: `${font}Bold` }]}
                        />
                      </View>
                      <View style={[styles.photoBadge, styles.distanceBadge]}>
                        <MapPin size={13} color={colors.greenDark} />
                        <Text style={[typography.small, { color: colors.greenDark, fontFamily: `${font}Bold` }]}>
                          {distanceLabel}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.mealCardBody}>
                    <View style={styles.mealCardHeader}>
                      <View style={styles.mealNameSection}>
                        <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]} numberOfLines={1}>
                          {displayName}
                        </Text>
                        <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]} numberOfLines={2}>
                          {displayDesc}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.mealDetailsRow}>
                      <View style={styles.mealDetailTag}>
                        <UtensilsCrossed size={12} color={colors.primary} />
                        <Text style={[typography.small, { color: colors.brown, fontFamily: `${font}SemiBold` }]}>
                          {t('availableCount')}: {meal.meals} {t('meals')}
                        </Text>
                      </View>
                      <View style={styles.mealDetailTag}>
                        <Clock size={12} color={colors.brownMuted} />
                        <Text style={[typography.micro, { color: colors.brownMuted, fontFamily: `${font}SemiBold` }]}>
                          {t('pickupWindow')}: {formatPickupTime(meal.pickup_start)} - {formatPickupTime(meal.pickup_end)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.mealCardDivider} />

                    <View style={styles.mealCardBottom}>
                      <View style={styles.donorInfo}>
                        {prof?.avatar_url ? (
                          <Image source={{ uri: prof.avatar_url }} style={styles.donorAvatar} />
                        ) : (
                          <View style={[styles.donorAvatar, { backgroundColor: avatarColor }]}>
                            <Text style={[typography.small, { color: colors.white, fontFamily: `${font}Bold` }]}>
                              {prof?.full_name?.charAt(0).toUpperCase() ?? '?'}
                            </Text>
                          </View>
                        )}
                        <View style={styles.donorNameSection}>
                          <View style={styles.donorNameRow}>
                            <Text style={[typography.small, { color: colors.brown, fontFamily: `${font}SemiBold` }]} numberOfLines={1}>
                              {prof?.full_name ?? '—'}
                            </Text>
                            {prof?.is_verified && <VerifiedBadge language={language} size={12} />}
                          </View>
                          <View style={styles.donorMetaRow}>
                            <View style={styles.donorMetaItem}>
                              <Star size={10} color={colors.golden} fill={colors.golden} />
                              <Text style={[typography.micro, { color: colors.brownMuted, fontFamily: `${font}SemiBold` }]}>
                                {(prof?.rating ?? 0).toFixed(1)}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[styles.orderBtn, (claimingId === meal.id || isOwnFood) && { opacity: 0.6 }]}
                        onPress={() => claimMeal(meal)}
                        disabled={claimingId === meal.id || isOwnFood}
                        activeOpacity={0.8}
                      >
                        {claimingId === meal.id ? (
                          <ActivityIndicator color={colors.white} size="small" />
                        ) : (
                          <>
                            <Heart size={16} color={colors.white} fill={colors.white} />
                            <Text style={[typography.small, { color: colors.white, fontFamily: `${font}Bold` }]}>
                              {isOwnFood ? t('myPublishedMeal') : t('orderMealBtn')}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {activeClaims.length > 0 && stage === 'browsing' && (
          <TouchableOpacity
            style={styles.viewActiveClaimsBtn}
            onPress={() => setStage('claimed')}
            activeOpacity={0.7}
          >
            <PackageCheck size={18} color={colors.white} />
            <Text style={[typography.small, { color: colors.white, fontFamily: `${font}Bold` }]}>
              {activeClaims.length} {t('activeMatchTitle')}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      <Modal visible={!!selectedMeal} transparent animationType="slide" onRequestClose={() => setSelectedMeal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.detailsModal}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedMeal(null)}><X size={22} color={colors.brown} /></TouchableOpacity>
            {selectedMeal && <>
              {getFoodImages(selectedMeal).length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.detailsImageList}>
                  {getFoodImages(selectedMeal).map((image, index) => <Image key={`${image}-${index}`} source={{ uri: image }} style={styles.detailsImage} />)}
                </ScrollView>
              ) : <View style={[styles.detailsImage, styles.mealPhotoFallback]}><UtensilsCrossed size={44} color={colors.brownMuted} /></View>}
              <Text style={[typography.heading, { color: colors.brown, fontFamily: `${font}Bold`, marginTop: spacing.md }]}>{selectedMeal.food_name}</Text>
              <Text style={[typography.body, { color: colors.brownMuted, fontFamily: `${font}Regular`, marginTop: spacing.xs }]}>{selectedMeal.description || t('partnerMeal')}</Text>
              <View style={styles.modalDetailsRow}><Text style={styles.modalDetail}>{selectedMeal.meals} {t('meals')}</Text><Text style={styles.modalDetail}>{distText(selectedMeal.distance_km)}</Text><Text style={styles.modalDetail}>{t('remainingTime')}: <LiveCountdown iso={selectedMeal.expires_at} lang={language} /></Text></View>
              <TouchableOpacity style={styles.modalClaimBtn} onPress={() => { void playInteractionSound(); const meal = selectedMeal; setSelectedMeal(null); void claimMeal(meal); }} disabled={selectedMeal.user_id === user?.id || claimingId === selectedMeal.id}><Text style={styles.modalClaimText}>{selectedMeal.user_id === user?.id ? t('myPublishedMeal') : t('orderMealBtn')}</Text></TouchableOpacity>
            </>}
          </View>
        </View>
      </Modal>
      <Modal visible={requestModal} transparent animationType="slide" onRequestClose={() => setRequestModal(false)}>
        <View style={styles.modalBackdrop}><View style={styles.detailsModal}>
          <TouchableOpacity style={styles.modalClose} onPress={() => setRequestModal(false)}><X size={22} color={colors.brown} /></TouchableOpacity>
          <Text style={[typography.heading, { color: colors.brown, fontFamily: `${font}Bold`, textAlign: 'center' }]}>{t('requestMealNow')}</Text>
          <Text style={[typography.body, { color: colors.brownMuted, fontFamily: `${font}Regular`, textAlign: 'center', marginTop: spacing.sm }]}>{t('searchingDonor')}</Text>
          <TextInput value={requestMeals} onChangeText={setRequestMeals} keyboardType="number-pad" style={styles.requestInput} placeholder={t('mealsNeeded')} placeholderTextColor={colors.brownMuted} />
          <TouchableOpacity style={styles.modalClaimBtn} onPress={submitMealRequest} disabled={requestBusy}>{requestBusy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.modalClaimText}>{t('requestMeal')}</Text>}</TouchableOpacity>
        </View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  headerCard: {
    alignItems: 'center', gap: spacing.sm,
    marginBottom: spacing.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.xl,
  },
  headerIcon: {
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 4,
  },
  locatingBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md,
    marginHorizontal: spacing.lg,
  },
  emptyState: {
    alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center',
  },
  mealList: {
    paddingHorizontal: spacing.lg, gap: spacing.md, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
  },
  mealCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden',
    width: '48.5%',
    borderWidth: 1.5, borderColor: colors.border,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 10, elevation: 3,
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(38, 24, 16, 0.55)', justifyContent: 'flex-end' },
  detailsModal: { backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, minHeight: 360 },
  modalClose: { alignSelf: 'flex-end', padding: spacing.xs },
  detailsImageList: { gap: spacing.sm },
  detailsImage: { width: 270, height: 190, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt },
  modalDetailsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  modalDetail: { ...typography.small, color: colors.brown, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  modalClaimBtn: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  modalClaimText: { ...typography.bodyBold, color: colors.white },
  requestMealBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.coral, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginTop: spacing.sm },
  requestInput: { ...typography.body, color: colors.brown, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg, textAlign: 'center' },
  mealPhotoWrap: {
    position: 'relative',
    backgroundColor: colors.surfaceAlt,
  },
  mealPhoto: {
    width: '100%', height: 220,
  },
  mealImageCountBadge: {
    position: 'absolute', top: spacing.sm, left: spacing.sm,
    minWidth: 34, height: 26, borderRadius: 13,
    backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  mealPhotoFallback: {
    justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surfaceAlt,
  },
  photoTopBadges: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.xs,
  },
  photoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    shadowColor: colors.shadowStrong,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  distanceBadge: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.greenBg,
  },
  mealCardBody: {
    padding: spacing.md,
  },
  mealCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm,
  },
  mealNameSection: {
    flex: 1, gap: 2,
  },
  mealDetailsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm,
  },
  mealDetailTag: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.pill,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  mealCardDivider: {
    height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.md,
  },
  mealCardBottom: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm,
  },
  donorInfo: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1,
  },
  donorAvatar: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  donorNameSection: {
    flex: 1, gap: 2,
  },
  donorNameRow: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  donorMetaRow: {
    flexDirection: 'row', gap: spacing.sm,
  },
  donorMetaItem: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
  },
  orderBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 2,
  },
  viewActiveClaimsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.green, borderRadius: radius.pill,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    marginHorizontal: spacing.lg, marginTop: spacing.lg,
    shadowColor: colors.green, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 3,
  },
  browseMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.pill,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    marginHorizontal: spacing.lg, marginTop: spacing.lg,
    borderWidth: 1.5, borderColor: colors.primary,
  },
  activeClaimCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden',
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    borderWidth: 1.5, borderColor: colors.border,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 10, elevation: 3,
  },
  activeClaimImg: {
    width: '100%', height: 120,
  },
  activeClaimBody: {
    padding: spacing.md,
  },
  activeClaimStatusRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.xs, marginBottom: spacing.md,
  },
  activeClaimStatusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  activeClaimChatBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, borderRadius: radius.lg,
    paddingVertical: spacing.md,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 3,
  },
  activeClaimConfirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.greenBg, borderRadius: radius.lg,
    paddingVertical: spacing.md, marginTop: spacing.sm,
    borderWidth: 2, borderColor: colors.green,
  },
});

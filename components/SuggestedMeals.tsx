import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, Image,
  ActivityIndicator, Modal, Alert,
} from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';
import {
  Heart, Clock, Navigation,
  CheckCircle2, HandHeart, AlertCircle,
} from 'lucide-react-native';
import { supabase, MealRequest, FoodDonation, Profile } from '@/lib/supabase';
import { Coords, haversineKm, ensureLocationPermission, getCurrentLocation } from '@/lib/location';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { apiFetch } from '@/lib/api';

export type RequestListItem = {
  id: string;
  meals: number;
  expires_at: string;
  latitude: number;
  longitude: number;
  created_at: string;
  requester_name: string;
  requester_id: string;
  requester_verified: boolean;
  avatar_url: string | null;
  distance: number | null;
  my_offer_id: string | null;
  my_offer_status: string | null;
};

const AVATAR_COLORS = ['#F7564C', '#1F7A45', '#F9A825', '#6B4F3A', '#2E6FB0', '#8E44AD'];
type NearbyMapItem = {
  item_type: 'request' | 'food'; item_id: string; user_id?: string; meals?: number;
  timing?: 'now' | 'later'; status?: 'open'; latitude?: number; longitude?: number;
  created_at?: string; updated_at?: string; expires_at?: string;
};

// Meal requests intentionally have a short, server-enforced discovery window.
// Unlike food donations, the database table has no expires_at column; derive the
// same 10-minute window used by get_nearby_map_items instead of treating every
// returned request as expired.
const REQUEST_DISCOVERY_WINDOW_MS = 10 * 60 * 1000;

function withRequestExpiry(request: Omit<MealRequest, 'expires_at'> | MealRequest): MealRequest {
  return {
    ...request,
    expires_at: ('expires_at' in request && request.expires_at) || new Date(new Date(request.created_at).getTime() + REQUEST_DISCOVERY_WINDOW_MS).toISOString(),
  } as MealRequest;
}

function mapItemToRequest(item: NearbyMapItem): MealRequest {
  const createdAt = item.created_at ?? new Date().toISOString();
  return withRequestExpiry({
    id: item.item_id,
    user_id: item.user_id ?? '',
    meals: item.meals ?? 1,
    timing: item.timing ?? 'now',
    status: 'open',
    latitude: item.latitude ?? 0,
    longitude: item.longitude ?? 0,
    created_at: createdAt,
    updated_at: item.updated_at ?? createdAt,
  });
}

function LiveCountdown({ iso, lang, style, onExpire }: { iso: string; lang: 'ar' | 'en'; style?: any; onExpire?: () => void }) {
  const [, setTick] = useState(0);
  const expired = React.useRef(false);

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

interface SuggestedMealsProps {
  location: Coords | null;
  showHeader?: boolean;
  emptyText?: string;
}

export function SuggestedMeals({ location, showHeader = true, emptyText }: SuggestedMealsProps) {
  const { t, language, user } = useAuth();
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';

  const [dbRequests, setDbRequests] = useState([] as MealRequest[]);
  const [dbFood, setDbFood] = useState([] as FoodDonation[]);
  const [dbProfiles, setDbProfiles] = useState(new Map() as Map<string, Profile>);
  const [myOffers, setMyOffers] = useState([] as { id: string; request_id: string; status: string }[]);
  const [expiredIds, setExpiredIds] = useState(new Set() as Set<string>);
  const [favorites, setFavorites] = useState(new Set() as Set<string>);
  const [sending, setSending] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [myLocation, setMyLocation] = useState<Coords | null>(null);

  const distTextAr = useCallback((dist: number | null) => {
    if (dist === null) return '—';
    if (dist < 1) return `${Math.round(dist * 1000)} ${language === 'ar' ? 'م' : 'm'}`;
    return `${dist.toFixed(1)} ${t('km')}`;
  }, [language, t]);

  const formatRequestTime = useCallback((iso: string) => {
    const d = new Date(iso);
    let h = d.getHours();
    const m = d.getMinutes();
    const period = language === 'ar' ? (h >= 12 ? 'م' : 'ص') : (h >= 12 ? 'PM' : 'AM');
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, '0')} ${period}`;
  }, [language]);

  const loadData = useCallback(async () => {
    if (!user) return;
    const currentLocation = location ?? myLocation;

    let requests: MealRequest[] = [];
    try {
      if (currentLocation) {
        const { items } = await apiFetch<{ items: NearbyMapItem[] }>(
          `/v1/map/nearby?latitude=${encodeURIComponent(Number(currentLocation.latitude.toFixed(3)))}&longitude=${encodeURIComponent(Number(currentLocation.longitude.toFixed(3)))}&radius_km=50`,
        );
        const requestIds = items.filter((item) => item.item_type === 'request').map((item) => item.item_id);
        const foodIds = items.filter((item) => item.item_type === 'food').map((item) => item.item_id);
        const foodDetails = foodIds.length
          ? await supabase.rpc('get_nearby_food_details', { p_ids: foodIds })
          : { data: [], error: null };
        setDbFood(foodDetails.error ? [] : ((foodDetails.data ?? []) as FoodDonation[]));
        if (requestIds.length > 0) {
          const { data, error } = await supabase.rpc('get_nearby_request_details', { p_ids: requestIds });
          const fallback = items.filter((item) => item.item_type === 'request').map(mapItemToRequest);
          requests = error || !data?.length
            ? fallback
            : data.map((request: Omit<MealRequest, 'expires_at'>) => withRequestExpiry(request));
        }
      }
    } catch {
      const { data } = await supabase
        .from('meal_requests')
        .select('*')
        .eq('status', 'open')
        .neq('user_id', user.id)
        .gt('created_at', new Date(Date.now() - REQUEST_DISCOVERY_WINDOW_MS).toISOString())
        .order('created_at', { ascending: false })
        .limit(100);
      requests = (data ?? []).map((request: Omit<MealRequest, 'expires_at'>) => withRequestExpiry(request));
      setDbFood([]);
    }

    if (requests && requests.length > 0) {
      const visibleRequests = requests.filter(r => r.user_id !== user.id);
      setDbRequests(visibleRequests);
      const userIds = [...new Set(visibleRequests.map(r => r.user_id))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds);
        if (profiles) {
          const map = new Map<string, Profile>();
          (profiles as Profile[]).forEach(p => map.set(p.id, p));
          setDbProfiles(map);
        }
      }
    } else {
      setDbRequests([]);
    }

    const { data: offers } = await supabase
      .from('offers')
      .select('id, request_id, status')
      .eq('helper_id', user.id);
    if (offers) {
      setMyOffers(offers as { id: string; request_id: string; status: string }[]);
    }
  }, [user, location, myLocation]);

  useEffect(() => {
    loadData();
    const sub = supabase
      .channel('nearby_requests_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_requests' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers' }, loadData)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [loadData]);

  const nearbyRequests = useMemo(() => {
    return dbRequests
      .filter(r => !expiredIds.has(r.id))
      .filter(r => new Date(r.expires_at).getTime() > Date.now())
      .map(r => {
        const profile = dbProfiles.get(r.user_id);
        const myOffer = myOffers.find(o => o.request_id === r.id);
        return {
          id: r.id,
          meals: r.meals,
          expires_at: r.expires_at,
          latitude: r.latitude,
          longitude: r.longitude,
          created_at: r.created_at,
          requester_name: profile?.full_name ?? '',
          requester_id: r.user_id,
          requester_verified: profile?.is_verified ?? false,
          avatar_url: profile?.avatar_url ?? null,
          distance: location ? haversineKm(location, { latitude: r.latitude, longitude: r.longitude }) : null,
          my_offer_id: myOffer?.id ?? null,
          my_offer_status: myOffer?.status ?? null,
        } as RequestListItem;
      })
      .sort((a, b) => (a.distance ?? 9999) - (b.distance ?? 9999));
  }, [dbRequests, dbProfiles, myOffers, location, expiredIds]);

  const nearbyFood = useMemo(() => dbFood
    .filter(food => food.status === 'available' && new Date(food.expires_at).getTime() > Date.now())
    .map(food => ({ ...food, distance: location ? haversineKm(location, { latitude: food.latitude, longitude: food.longitude }) : null }))
    .sort((a, b) => (a.distance ?? 9999) - (b.distance ?? 9999)), [dbFood, location]);

  const handleExpire = useCallback((id: string) => {
    setExpiredIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const sendOffer = useCallback(async (req: RequestListItem) => {
    if (!user) {
      Alert.alert(t('errorGeneric'));
      return;
    }

    if (!myLocation) {
      const ok = await ensureLocationPermission();
      if (!ok) {
        Alert.alert(t('locationError'));
        return;
      }
      const coords = await getCurrentLocation();
      if (coords) setMyLocation(coords);
    }

    const coords = myLocation ?? location;
    if (!coords) {
      Alert.alert(t('locationError'));
      return;
    }

    setSending(true);
    const { error } = await supabase.from('offers').insert({
      request_id: req.id,
      helper_id: user.id,
      status: 'pending',
      offered_meals: req.meals,
      latitude: coords.latitude,
      longitude: coords.longitude,
    });
    setSending(false);

    if (error) {
      const msg = error.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) {
        Alert.alert(t('offerPending'));
      } else {
        Alert.alert(t('errorGeneric'));
      }
      return;
    }

    setShowSuccessModal(true);
    loadData();
  }, [user, myLocation, location, t, loadData]);

  const renderRequestCard = (req: RequestListItem, index: number) => {
    const isUrgent = new Date(req.expires_at).getTime() - Date.now() < 3600_000;
    const isFav = favorites.has(req.id);
    const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];
    const hasOffer = req.my_offer_status === 'pending';
    const offerDeclined = req.my_offer_status === 'declined';

    return (
      <View key={req.id} style={styles.mealCard}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardProfileSection}>
            {req.avatar_url ? (
              <Image source={{ uri: req.avatar_url }} style={styles.cardAvatar} />
            ) : (
              <View style={[styles.cardAvatar, styles.cardAvatarFallback, { backgroundColor: avatarColor }]}>
                <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>
                  {req.requester_name.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={styles.cardNameSection}>
              <View style={styles.cardNameRow}>
                <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]} numberOfLines={1}>
                  {req.requester_name || '—'}
                </Text>
                {req.requester_verified && <VerifiedBadge language={language} size={14} />}
                <Heart size={14} color={colors.coral} fill={colors.coral} />
              </View>
              <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]} numberOfLines={1}>
                {t('mealRequestLabel')} · {t('meal')} {index + 1}
              </Text>
            </View>
          </View>
          <View style={[styles.cardCountdownBadge, { backgroundColor: isUrgent ? colors.error : colors.warning }]}>
            <Clock size={11} color={colors.white} />
            <Text style={[typography.micro, { color: colors.white, fontFamily: `${font}Bold` }]}>
              {t('requestExpiresIn')}
            </Text>
            <LiveCountdown
              iso={req.expires_at}
              lang={language}
              onExpire={() => handleExpire(req.id)}
              style={[typography.micro, { color: colors.white, fontFamily: `${font}Bold` }]}
            />
          </View>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardBottomRow}>
          <View style={styles.cardMetaLeft}>
            <View style={styles.cardTimeChip}>
              <Clock size={12} color={colors.brownMuted} />
              <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                {formatRequestTime(req.created_at)}
              </Text>
            </View>
            <View style={styles.cardDistChip}>
              <Navigation size={12} color={colors.greenDark} />
              <Text style={[typography.small, { color: colors.greenDark, fontFamily: `${font}SemiBold` }]}>
                {distTextAr(req.distance)}
              </Text>
            </View>
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.cardFavBtn}
              onPress={() => toggleFavorite(req.id)}
              activeOpacity={0.7}
            >
              <Heart
                size={20}
                color={isFav ? colors.coral : colors.brownMuted}
                fill={isFav ? colors.coral : 'none'}
              />
            </TouchableOpacity>
            {hasOffer ? (
              <View style={styles.offerPendingBadge}>
                <Clock size={14} color={colors.warning} />
                <Text style={[typography.small, { color: colors.warning, fontFamily: `${font}SemiBold` }]}>
                  {t('offerPending')}
                </Text>
              </View>
            ) : offerDeclined ? (
              <View style={styles.offerDeclinedBadge}>
                <AlertCircle size={14} color={colors.error} />
                <Text style={[typography.small, { color: colors.error, fontFamily: `${font}SemiBold` }]}>
                  {t('offerDeclinedByRequester')}
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.offerBtn}
                onPress={() => sendOffer(req)}
                disabled={sending}
                activeOpacity={0.8}
              >
                {sending ? (
                  <ActivityIndicator color={colors.white} size={16} />
                ) : (
                  <>
                    <HandHeart size={16} color={colors.white} />
                    <Text style={[typography.small, { color: colors.white, fontFamily: `${font}Bold` }]}>
                      {t('iHaveMeal')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (nearbyRequests.length === 0 && nearbyFood.length === 0) {
    return (
      <View style={styles.sectionWrap}>
        {showHeader && (
          <Text style={[typography.heading, { color: colors.brown, marginBottom: spacing.sm, fontFamily: `${font}Bold` }]}>
            {t('availableMealsNearby')}
          </Text>
        )}
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceAlt }]}>
            <Heart size={40} color={colors.brownMuted} />
          </View>
          <Text style={[typography.caption, { color: colors.brownMuted, marginTop: spacing.xs, fontFamily: `${font}Regular`, textAlign: 'center' }]}>
            {emptyText || t('noNearbyFood')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.sectionWrap}>
      {showHeader && (
        <Text style={[typography.heading, { color: colors.brown, marginBottom: spacing.sm, fontFamily: `${font}Bold` }]}>
          {t('availableMealsNearby')}
        </Text>
      )}
      {nearbyFood.length > 0 && (
        <View style={styles.foodList}>
          {nearbyFood.map((food) => (
            <View key={food.id} style={styles.foodCard}>
              {food.image_url ? <Image source={{ uri: food.image_url }} style={styles.foodImage} /> : <View style={styles.foodImagePlaceholder}><Heart size={24} color={colors.green} /></View>}
              <View style={styles.foodInfo}>
                <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]} numberOfLines={1}>{food.food_name}</Text>
                <Text style={[typography.small, { color: colors.greenDark, fontFamily: `${font}SemiBold` }]}>📍 {food.distance === null ? '—' : food.distance < 1 ? `${Math.round(food.distance * 1000)} ${language === 'ar' ? 'م' : 'm'}` : `${food.distance.toFixed(1)} ${t('km')}`}</Text>
                <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>{food.meals} {t('meal')}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
      <View style={styles.mealList}>
        {nearbyRequests.map((req, index) => renderRequestCard(req, index))}
      </View>

      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowSuccessModal(false); }}
      >
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={[styles.successIcon, { backgroundColor: colors.greenBg }]}>
              <CheckCircle2 size={56} color={colors.green} />
            </View>
            <Text style={[typography.title, { color: colors.brown, marginTop: spacing.md, fontFamily: `${font}Bold`, textAlign: 'center' }]}>
              {t('offerSentTitle')}
            </Text>
            <Text style={[typography.caption, { color: colors.brownMuted, textAlign: 'center', marginTop: spacing.xs, fontFamily: `${font}Regular` }]}>
              {t('offerSentDesc')}
            </Text>
            <TouchableOpacity
              style={styles.successBtn}
              onPress={() => { setShowSuccessModal(false); }}
              activeOpacity={0.8}
            >
              <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>
                {t('back')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  emptyState: { alignItems: 'center', paddingVertical: spacing.lg },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  mealList: { gap: spacing.md },
  foodList: { gap: spacing.sm, marginBottom: spacing.md },
  foodCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, padding: spacing.sm, gap: spacing.sm },
  foodImage: { width: 68, height: 68, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  foodImagePlaceholder: { width: 68, height: 68, borderRadius: radius.md, backgroundColor: colors.greenBg, alignItems: 'center', justifyContent: 'center' },
  foodInfo: { flex: 1, gap: 3 },
  mealCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden',
    borderWidth: 1.5, borderColor: colors.border,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 10, elevation: 3,
  },
  cardTopRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md,
  },
  cardProfileSection: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1,
  },
  cardAvatar: {
    width: 48, height: 48, borderRadius: 24,
  },
  cardAvatarFallback: {
    justifyContent: 'center', alignItems: 'center',
  },
  cardNameSection: {
    flex: 1, gap: 2,
  },
  cardNameRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  cardCountdownBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 6,
  },
  cardDivider: {
    height: 1, backgroundColor: colors.borderLight, marginHorizontal: spacing.md,
  },
  cardBottomRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md,
  },
  cardMetaLeft: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  cardTimeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  cardDistChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.greenBg, borderRadius: radius.pill,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  cardActions: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  cardFavBtn: {
    padding: spacing.xs,
  },
  offerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 2,
  },
  offerPendingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.warningBg ?? '#FFF6E0', borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderWidth: 1.5, borderColor: colors.warning,
  },
  offerDeclinedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FDECEC', borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderWidth: 1.5, borderColor: colors.error,
  },
  successOverlay: {
    flex: 1, backgroundColor: colors.overlay,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl,
  },
  successCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl,
    alignItems: 'center', width: '100%',
    shadowColor: colors.shadowStrong, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 24, elevation: 16,
  },
  successIcon: {
    width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center',
  },
  successBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl, marginTop: spacing.xl,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
});

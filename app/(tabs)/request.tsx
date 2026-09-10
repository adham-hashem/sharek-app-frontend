import React, { useState, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, ScrollView, Alert, TextInput } from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { Heart, Minus, Plus, Clock, X, CheckCircle2, Loader2, Star, Navigation, MapPin, Bell, RotateCcw, MessageCircle, PackageCheck, Truck } from 'lucide-react-native';
import { supabase, MealRequest, Offer, Profile, Match } from '@/lib/supabase';
import { ensureLocationPermission, getCurrentLocation, watchLocation, Coords } from '@/lib/location';
import { apiPost } from '@/lib/api';
import { playNotificationSound } from '@/lib/sound';
import { router } from 'expo-router';
import { LiveMatchMap } from '@/components/LiveMatchMap';

// The donor response window is 15s per offer; the request remains searchable for 60s.
const SEARCH_DURATION = 60;

type Phase = 'form' | 'searching' | 'offer' | 'matched' | 'noDonor';

interface OfferWithProfile extends Offer {
  helper_profile: Profile;
  distance_km: number | null;
}

function haversineKm(a: Coords, b: { latitude: number; longitude: number }): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export default function RequestScreen() {
  const { t, language, user, settings } = useAuth();
  const [meals, setMeals] = useState(1);
  const [timing, setTiming] = useState<'now' | 'later'>('now');
  const [location, setLocation] = useState<Coords | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [myRequest, setMyRequest] = useState<MealRequest | null>(null);
  const [offers, setOffers] = useState<OfferWithProfile[]>([]);
  const [activeOffer, setActiveOffer] = useState<OfferWithProfile | null>(null);
  const [countdown, setCountdown] = useState(SEARCH_DURATION);
  const [actionBusy, setActionBusy] = useState(false);
  const [matchedData, setMatchedData] = useState<Match | null>(null);
  const [helperProfile, setHelperProfile] = useState<Profile | null>(null);
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSent, setRatingSent] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const font = language === 'ar' ? 'Cairo-' : 'Inter-';

  useEffect(() => {
    (async () => {
      const ok = await ensureLocationPermission();
      if (ok) {
        const coords = await getCurrentLocation();
        if (coords) setLocation(coords);
      }
    })();
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancelRequest = useCallback(async () => {
    stopTimer();
    if (!myRequest) {
      setPhase('form');
      return;
    }
    await apiPost(`/v1/meal-requests/${myRequest.id}/cancel`).catch(() => undefined);
    setMyRequest(null);
    setOffers([]);
    setActiveOffer(null);
    setPhase('form');
  }, [myRequest, stopTimer]);

  const acceptOffer = useCallback(async (offer: OfferWithProfile) => {
    if (!user || !myRequest) return;
    setActionBusy(true);

    const { data: match, error: offerErr } = await apiPost<Match>(`/v1/meal-requests/${myRequest.id}/offers/${offer.id}/accept`)
      .then((data) => ({ data, error: null as unknown }))
      .catch((error) => ({ data: null, error }));
    if (offerErr || !match) {
      setActionBusy(false);
      Alert.alert(t('errorGeneric'));
      return;
    }

    setActionBusy(false);
    stopTimer();

    setMatchedData(match);
    setHelperProfile(offer.helper_profile);

    setPhase('matched');
  }, [user, myRequest, stopTimer, t]);

  const declineOffer = useCallback(async (offer: OfferWithProfile) => {
    if (!myRequest) return;
    await apiPost(`/v1/meal-requests/${myRequest.id}/offers/${offer.id}/decline`).catch(() => undefined);
    setOffers(prev => prev.filter(o => o.id !== offer.id));
    setActiveOffer(prev => prev && prev.id === offer.id ? null : prev);
  }, [myRequest]);

  const confirmReceipt = useCallback(async () => {
    if (!matchedData) return;
    setActionBusy(true);
    const { data, error } = await apiPost<Match>(`/v1/matches/${matchedData.id}/confirm-receipt`)
      .then((result) => ({ data: result, error: null as unknown })).catch((err) => ({ data: null, error: err }));
    setActionBusy(false);
    if (error || !data) { Alert.alert(t('errorGeneric')); return; }
    setMatchedData(data);
  }, [matchedData, t]);

  const submitRating = useCallback(async () => {
    if (!matchedData || ratingScore < 1 || ratingSent) return;
    setActionBusy(true);
    try {
      await apiPost(`/v1/matches/${matchedData.id}/ratings`, { score: ratingScore, comment: ratingComment.trim() || undefined });
      setRatingSent(true);
    } catch {
      Alert.alert(t('errorGeneric'));
    } finally {
      setActionBusy(false);
    }
  }, [matchedData, ratingScore, ratingComment, ratingSent, t]);

  const submit = async () => {
    if (!location) {
      Alert.alert(t('locationError'));
      return;
    }
    setSubmitting(true);
    const { data, error } = await apiPost<MealRequest>('/v1/meal-requests', {
        meals,
        timing,
        latitude: location.latitude,
        longitude: location.longitude,
      }).then((result) => ({ data: result, error: null as unknown }))
        .catch((err) => ({ data: null, error: err }));
    setSubmitting(false);
    if (error) {
      Alert.alert(t('errorGeneric'));
      return;
    }
    setMyRequest(data as MealRequest);
    setOffers([]);
    setActiveOffer(null);
    setCountdown(SEARCH_DURATION);
    setPhase('searching');
  };

  useEffect(() => {
    if (phase !== 'searching' || !myRequest) return;

    const channel = supabase
      .channel(`offers_${myRequest.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'offers',
        filter: `request_id=eq.${myRequest.id}`,
      }, async (payload) => {
        const newOffer = payload.new as Offer;
        if (newOffer.status !== 'pending') return;

        const { data: profile } = await supabase
          .from('public_profiles')
          .select('*')
          .eq('id', newOffer.helper_id)
          .maybeSingle();

        if (!profile) return;

        const dist = location
          ? haversineKm(location, { latitude: newOffer.latitude, longitude: newOffer.longitude })
          : null;

        const offerWithProfile: OfferWithProfile = {
          ...newOffer,
          helper_profile: profile as Profile,
          distance_km: dist,
        };

        setOffers(prev => {
          if (prev.some(o => o.id === newOffer.id)) return prev;
          return [...prev, offerWithProfile];
        });
        setActiveOffer(prev => prev ?? offerWithProfile);
        // Keep the global search timer running while the offer card is visible;
        // each offer carries its own 15-second expiry in the database.

        if (settings?.request_sound_enabled) {
          playNotificationSound();
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'offers',
        filter: `request_id=eq.${myRequest.id}`,
      }, (payload) => {
        const updated = payload.new as Offer;
        if (updated.status === 'accepted') {
          stopTimer();
          // The match row is created in the same database transaction. Keep
          // this subscription alive until its INSERT arrives so a fast
          // realtime offer update cannot leave the screen in a matched phase
          // without the match coordinates.
          setOffers(prev => prev.filter((offer) => offer.id !== updated.id));
          setActiveOffer(prev => prev?.id === updated.id ? null : prev);
        }
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'matches', filter: `request_id=eq.${myRequest.id}`,
      }, async (payload) => {
        const match = payload.new as Match;
        setMatchedData(match);
        const { data: helper } = await supabase.from('public_profiles').select('*').eq('id', match.helper_id).maybeSingle();
        if (helper) setHelperProfile(helper as Profile);
        stopTimer();
        setPhase('matched');
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [phase, myRequest, location, settings, stopTimer]);

  useEffect(() => {
    if (phase !== 'searching') return;
    setCountdown(SEARCH_DURATION);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          stopTimer();
          setPhase('noDonor');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => stopTimer();
  }, [phase, stopTimer]);

  // Rotate stale donor offers without blocking the overall search.
  useEffect(() => {
    if (phase !== 'searching' || !activeOffer) return;
    const id = setInterval(() => {
      const expiresAt = new Date(activeOffer.response_expires_at ?? new Date(new Date(activeOffer.created_at).getTime() + 15_000).toISOString()).getTime();
      if (expiresAt <= Date.now()) {
        setOffers((current) => current.filter((offer) => offer.id !== activeOffer.id));
        setActiveOffer((current) => {
          if (!current || current.id !== activeOffer.id) return current;
          return offers.find((offer) => offer.id !== activeOffer.id) ?? null;
        });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase, activeOffer, offers]);

  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  const retry = () => {
    setPhase('form');
    setMyRequest(null);
    setOffers([]);
    setActiveOffer(null);
  };

  const distText = (dist: number | null) => {
    if (dist === null) return '';
    if (dist < 1) return `${Math.round(dist * 1000)} m`;
    return `${dist.toFixed(1)} ${t('km')}`;
  };

  // Subscribe to match updates for live helper GPS
  useEffect(() => {
    if (phase !== 'matched' || !matchedData) return;
    const sub = supabase
      .channel(`req_match_${matchedData.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'matches',
        filter: `id=eq.${matchedData.id}`,
      }, (payload) => {
        const updated = payload.new as Match;
        setMatchedData(updated);
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [phase, matchedData]);

  // Share requester GPS only for the active match and stop it immediately afterwards.
  useEffect(() => {
    if (phase !== 'matched' || !matchedData) return;
    let cleanup: (() => void) | undefined;
    let alive = true;
    (async () => {
      cleanup = await watchLocation((coords) => {
        if (!alive) return;
        setLocation(coords);
        apiPost(`/v1/matches/${matchedData.id}/requester-location`, coords).catch(() => undefined);
      });
    })();
    return () => { alive = false; cleanup?.(); };
  }, [phase, matchedData]);

  if (phase === 'noDonor') {
    return (
      <View style={styles.container}>
        <View style={styles.centerWrap}>
          <View style={[styles.statusIcon, { backgroundColor: colors.surfaceAlt }]}>
            <X size={48} color={colors.brownMuted} />
          </View>
          <Text style={[typography.title, { color: colors.brown, marginTop: spacing.md, fontFamily: `${font}Bold` }]}>
            {t('noDonorFound')}
          </Text>
          <Text style={[typography.body, { color: colors.brownMuted, textAlign: 'center', marginTop: spacing.xs, fontFamily: `${font}Regular` }]}>
            {t('noDonorFoundDesc')}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={retry} activeOpacity={0.8}>
            <RotateCcw size={20} color={colors.white} />
            <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>
              {t('retryRequest')}
            </Text>
          </TouchableOpacity>
          {myRequest && (
            <TouchableOpacity style={styles.cancelLink} onPress={cancelRequest} activeOpacity={0.7}>
              <Text style={[typography.body, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                {t('cancelRequest')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  if (phase === 'matched') {
    const ds = matchedData?.delivery_status ?? 'accepted';
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120, paddingTop: spacing.xl, paddingHorizontal: spacing.lg }}>
        {/* Status banner */}
        <View style={[styles.matchedBanner, { backgroundColor: colors.greenBg }]}>
          <CheckCircle2 size={24} color={colors.greenDark} />
          <Text style={[typography.bodyBold, { color: colors.greenDark, fontFamily: `${font}Bold` }]}>
            {matchedData?.status === 'completed' ? t('matchCompleted') : ds === 'delivered' ? t('waitingForReceipt') : t('matched')}
          </Text>
        </View>

        {/* Helper card */}
        {helperProfile && (
          <View style={styles.matchedCard}>
            <View style={styles.matchedUserRow}>
              <View style={[styles.matchedAvatar, { backgroundColor: colors.green }]}>
                <Text style={[typography.heading, { color: colors.white, fontFamily: `${font}Bold` }]}>
                  {helperProfile.full_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]} numberOfLines={1}>
                  {helperProfile.full_name}
                </Text>
                {helperProfile.rating > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                    <Star size={12} color={colors.golden} fill={colors.golden} />
                    <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}SemiBold` }]}>
                      {helperProfile.rating.toFixed(1)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Live GPS map */}
        {myRequest && matchedData && (
          <LiveMatchMap
            requesterLat={location?.latitude ?? myRequest.latitude}
            requesterLng={location?.longitude ?? myRequest.longitude}
            helperLat={matchedData.helper_lat}
            helperLng={matchedData.helper_lng}
            userRole="requester"
            font={font}
            distLabel={t('liveDistance')}
            helperLabel={t('helperLocation')}
            requesterLabel={t('requesterLocation')}
          />
        )}

        {/* Chat button */}
        {myRequest && (activeOffer?.helper_id || matchedData?.helper_id) && (
          <TouchableOpacity
            style={[styles.matchedChatBtn, { backgroundColor: colors.green }]}
            onPress={() => router.push({
              pathname: '/chat',
              params: { mealRequestId: myRequest.id, otherUserId: activeOffer?.helper_id ?? matchedData?.helper_id },
            })}
            activeOpacity={0.8}
          >
            <MessageCircle size={20} color={colors.white} />
            <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>
              {t('openChat')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Status display */}
        <View style={styles.matchedStatusRow}>
          <View style={[styles.matchedStatusPill, ds === 'accepted' && { backgroundColor: colors.greenBg }, ds === 'awaiting_pickup' && { backgroundColor: colors.warningBg }, ds === 'delivered' && { backgroundColor: colors.successBg }]}>
            {ds === 'delivered' ? <PackageCheck size={14} color={colors.greenDark} /> : ds === 'awaiting_pickup' ? <Truck size={14} color={colors.goldenDark} /> : <CheckCircle2 size={14} color={colors.greenDark} />}
            <Text style={[typography.small, { color: ds === 'awaiting_pickup' ? colors.goldenDark : colors.greenDark, fontFamily: `${font}SemiBold` }]}>
            {matchedData?.status === 'completed' ? t('statusCompleted') : ds === 'delivered' ? t('waitingForReceipt') : ds === 'awaiting_pickup' ? t('statusAwaiting') : t('statusAccepted')}
            </Text>
          </View>
        </View>
        {ds === 'delivered' && matchedData?.status !== 'completed' && (
          <TouchableOpacity style={[styles.matchedChatBtn, { backgroundColor: colors.primary }]} onPress={confirmReceipt} disabled={actionBusy}>
            {actionBusy ? <ActivityIndicator color={colors.white} /> : <PackageCheck size={20} color={colors.white} />}
            <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>{t('confirmReceipt')}</Text>
          </TouchableOpacity>
        )}
        {matchedData?.status === 'completed' && (
          <View style={styles.ratingCard}>
            <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold`, textAlign: 'center' }]}>{t('rateExperience')}</Text>
            {ratingSent ? <Text style={[typography.caption, { color: colors.greenDark, fontFamily: `${font}SemiBold`, textAlign: 'center', marginTop: spacing.sm }]}>{t('rateSubmitted')}</Text> : <>
              <View style={styles.ratingStars}>{[1, 2, 3, 4, 5].map((score) => <TouchableOpacity key={score} onPress={() => setRatingScore(score)} accessibilityRole="button" accessibilityLabel={`${score} stars`}><Star size={30} color={colors.golden} fill={score <= ratingScore ? colors.golden : 'none'} /></TouchableOpacity>)}</View>
              <TextInput value={ratingComment} onChangeText={setRatingComment} placeholder={t('commentOptional')} placeholderTextColor={colors.brownMuted} style={[styles.ratingInput, { fontFamily: `${font}Regular` }]} multiline maxLength={500} />
              <TouchableOpacity onPress={submitRating} disabled={ratingScore === 0 || actionBusy} style={[styles.matchedChatBtn, { backgroundColor: ratingScore === 0 ? colors.border : colors.primary }]}>{actionBusy ? <ActivityIndicator color={colors.white} /> : <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>{t('submitRating')}</Text>}</TouchableOpacity>
            </>}
          </View>
        )}
      </ScrollView>
    );
  }

  if (phase === 'offer' || (phase === 'searching' && offers.length > 0)) {
    const offer = activeOffer ?? offers[0];
    return (
      <View style={styles.container}>
        <View style={styles.searchingHeader}>
          <Loader2 size={20} color={colors.primary} />
          <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]}>
            {t('searchingDonor')}
          </Text>
          <View style={styles.timerBadge}>
            <Text style={[typography.small, { color: colors.primary, fontFamily: `${font}Bold` }]}>
              {countdown}s
            </Text>
          </View>
        </View>

        {offer && (
          <ScrollView style={styles.offerScroll} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
            <View style={styles.offerCard}>
              <View style={styles.offerBadge}>
                <Bell size={12} color={colors.white} />
                <Text style={[typography.micro, { color: colors.white, fontFamily: `${font}Bold` }]}>
                  {t('newOffer')}
                </Text>
              </View>

              <View style={styles.offerHeader}>
                <View style={[styles.offerAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={[typography.heading, { color: colors.white, fontFamily: `${font}Bold` }]}>
                    {offer.helper_profile.full_name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]} numberOfLines={1}>
                    {offer.helper_profile.full_name}
                  </Text>
                  <View style={styles.offerMetaRow}>
                    <View style={styles.offerMetaItem}>
                      <Star size={12} color={colors.golden} fill={colors.golden} />
                      <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}SemiBold` }]}>
                        {Number(offer.helper_profile.rating).toFixed(1)}
                      </Text>
                    </View>
                    <View style={styles.offerMetaItem}>
                      <Navigation size={12} color={colors.greenDark} />
                      <Text style={[typography.small, { color: colors.greenDark, fontFamily: `${font}SemiBold` }]}>
                        {distText(offer.distance_km)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.offerDetails}>
                <View style={styles.offerDetailCell}>
                  <Text style={[typography.micro, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                    {t('offeredMeals')}
                  </Text>
                  <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]}>
                    {offer.offered_meals} {t('meals')}
                  </Text>
                </View>
                <View style={styles.offerDetailCell}>
                  <Text style={[typography.micro, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                    {t('mealsNeeded')}
                  </Text>
                  <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]}>
                    {myRequest?.meals ?? meals} {t('meals')}
                  </Text>
                </View>
              </View>

              {offers.length > 1 && (
                <Text style={[typography.caption, { color: colors.primary, textAlign: 'center', marginVertical: spacing.xs, fontFamily: `${font}SemiBold` }]}>
                  +{offers.length - 1} {t('newOffer')}
                </Text>
              )}

              <View style={styles.offerActions}>
                <TouchableOpacity
                  style={[styles.offerBtn, styles.declineBtn]}
                  onPress={() => declineOffer(offer)}
                  disabled={actionBusy}
                  activeOpacity={0.7}
                >
                  <X size={20} color={colors.error} />
                  <Text style={[typography.bodyBold, { color: colors.error, fontFamily: `${font}Bold` }]}>
                    {t('decline')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.offerBtn, styles.acceptBtn]}
                  onPress={() => acceptOffer(offer)}
                  disabled={actionBusy}
                  activeOpacity={0.8}
                >
                  {actionBusy ? <ActivityIndicator color={colors.white} size={18} /> : (
                    <>
                      <CheckCircle2 size={20} color={colors.white} />
                      <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>
                        {t('accept')}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.cancelLink} onPress={cancelRequest} activeOpacity={0.7}>
              <Text style={[typography.body, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                {t('cancelRequest')}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    );
  }

  if (phase === 'searching') {
    return (
      <View style={styles.container}>
        <View style={styles.centerWrap}>
          <View style={styles.searchingAnim}>
            <Loader2 size={56} color={colors.primary} />
          </View>
          <Text style={[typography.title, { color: colors.brown, marginTop: spacing.lg, fontFamily: `${font}Bold`, textAlign: 'center' }]}>
            {t('searchingDonor')}
          </Text>
          <Text style={[typography.body, { color: colors.brownMuted, textAlign: 'center', marginTop: spacing.xs, fontFamily: `${font}Regular` }]}>
            {myRequest?.meals ?? meals} {t('meals')} · {myRequest?.timing === 'now' ? t('now') : t('later')}
          </Text>

          <View style={styles.countdownCircle}>
            <Text style={[typography.huge, { color: colors.primary, fontFamily: `${font}ExtraBold` }]}>
              {countdown}
            </Text>
          </View>

          <TouchableOpacity style={styles.cancelLink} onPress={cancelRequest} activeOpacity={0.7}>
            <Text style={[typography.body, { color: colors.error, fontFamily: `${font}Regular` }]}>
              {t('cancelRequest')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.headerCard}>
        <View style={[styles.headerIcon, { backgroundColor: colors.coral }]}>
          <Heart size={28} color={colors.white} />
        </View>
        <Text style={[typography.heading, { color: colors.brown, fontFamily: `${font}Bold` }]}>
          {t('requestingMeal')}
        </Text>
      </View>

      <Text style={[typography.bodyBold, { color: colors.brown, marginBottom: spacing.sm, fontFamily: `${font}Bold` }]}>
        {t('mealsNeeded')}
      </Text>

      <View style={styles.stepper}>
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() => setMeals((m) => Math.max(1, m - 1))}
          disabled={meals <= 1}
        >
          <Minus size={22} color={meals <= 1 ? colors.brownMuted : colors.primary} />
        </TouchableOpacity>
        <Text style={[typography.huge, { color: colors.brown, minWidth: 60, textAlign: 'center', fontFamily: `${font}ExtraBold` }]}>
          {meals}
        </Text>
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() => setMeals((m) => Math.min(100, m + 1))}
          disabled={meals >= 100}
        >
          <Plus size={22} color={meals >= 100 ? colors.brownMuted : colors.primary} />
        </TouchableOpacity>
      </View>

      <Text style={[typography.bodyBold, { color: colors.brown, marginBottom: spacing.sm, marginTop: spacing.lg, fontFamily: `${font}Bold` }]}>
        {t('now')} / {t('later')}
      </Text>

      <View style={styles.timingRow}>
        <TouchableOpacity
          style={[styles.timingBtn, timing === 'now' && styles.timingActive]}
          onPress={() => setTiming('now')}
        >
          <Clock size={20} color={timing === 'now' ? colors.white : colors.brownMuted} />
          <Text style={[typography.bodyBold, { color: timing === 'now' ? colors.white : colors.brown, fontFamily: `${font}Bold` }]}>
            {t('now')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.timingBtn, timing === 'later' && styles.timingActive]}
          onPress={() => setTiming('later')}
        >
          <Clock size={20} color={timing === 'later' ? colors.white : colors.brownMuted} />
          <Text style={[typography.bodyBold, { color: timing === 'later' ? colors.white : colors.brown, fontFamily: `${font}Bold` }]}>
            {t('later')}
          </Text>
        </TouchableOpacity>
      </View>

      {!location && (
        <View style={styles.warnBox}>
          <Text style={[typography.caption, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
            {t('locating')}...
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.submitBtn, !location && { opacity: 0.5 }]}
        onPress={submit}
        disabled={submitting || !location}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <>
            <Heart size={22} color={colors.white} />
            <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>
              {t('requestMeal')}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  headerCard: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl },
  headerIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  stepper: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, paddingVertical: spacing.md,
    borderWidth: 1.5, borderColor: colors.border,
  },
  stepBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.white,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2,
  },
  timingRow: { flexDirection: 'row', gap: spacing.md },
  timingBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingVertical: spacing.md,
    borderWidth: 1.5, borderColor: colors.border,
  },
  timingActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  warnBox: { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, padding: spacing.sm, alignItems: 'center', marginTop: spacing.md },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md,
    marginTop: spacing.xl,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  searchingAnim: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: colors.surfaceAlt,
    justifyContent: 'center', alignItems: 'center',
  },
  countdownCircle: {
    width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: colors.primary,
    justifyContent: 'center', alignItems: 'center', marginTop: spacing.xl,
  },
  statusCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 16, elevation: 4,
  },
  statusIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md,
    marginTop: spacing.xl, paddingHorizontal: spacing.xl,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  cancelLink: { paddingVertical: spacing.md, marginTop: spacing.sm },
  searchingHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
  },
  timerBadge: {
    backgroundColor: colors.surfaceAlt, borderRadius: radius.pill,
    paddingHorizontal: spacing.sm, paddingVertical: 2, borderWidth: 1.5, borderColor: colors.border,
  },
  offerScroll: { flex: 1, paddingHorizontal: spacing.lg },
  offerCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1.5, borderColor: colors.border,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 16, elevation: 4,
  },
  offerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingHorizontal: spacing.sm, paddingVertical: 3, marginBottom: spacing.md,
  },
  offerHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  offerAvatar: {
    width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center',
  },
  offerMetaRow: { flexDirection: 'row', gap: spacing.md, marginTop: 2 },
  offerMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  offerDetails: {
    flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md,
  },
  offerDetailCell: { flex: 1 },
  offerActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  offerBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    borderRadius: radius.md, paddingVertical: spacing.md,
  },
  acceptBtn: {
    backgroundColor: colors.green,
    shadowColor: colors.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  declineBtn: {
    backgroundColor: colors.errorBg, borderWidth: 1.5, borderColor: colors.error,
  },
  matchedBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    borderRadius: radius.lg, paddingVertical: spacing.md, marginBottom: spacing.md,
  },
  matchedCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1.5, borderColor: colors.border, marginBottom: spacing.md,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  matchedUserRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  matchedAvatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  matchedChatBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    borderRadius: radius.md, paddingVertical: spacing.md, marginBottom: spacing.md,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  matchedStatusRow: { alignItems: 'center', marginTop: spacing.sm },
  ratingCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: colors.border },
  ratingStars: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md },
  ratingInput: { minHeight: 70, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, color: colors.brown, textAlignVertical: 'top', marginTop: spacing.md },
  matchedStatusPill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
});

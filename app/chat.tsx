import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image,
  Dimensions, Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { apiFetch, apiPost } from '@/lib/api';
import { supabase, Message, FoodDonation, Profile, FoodDonationStatus, Match } from '@/lib/supabase';
import {
  ChevronLeft, Send, UtensilsCrossed, MessageCircle,
  CheckCircle2, MapPin, Navigation, Clock, Package,
  LocateFixed, Star,
} from 'lucide-react-native';
import { ensureLocationPermission, getCurrentLocation, haversineKm, Coords } from '@/lib/location';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { AchievementBadgeMini } from '@/components/AchievementBadge';
import { RatingModal } from '@/components/RatingModal';
import { createNotification } from '@/lib/notifications';
import { getPrimaryFoodImage } from '@/lib/foodImages';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MAP_HEIGHT = SCREEN_WIDTH >= 768 ? 280 : 220;

const PICKUP_MAP_HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#FFF8F0;}
.sharek-marker{background:transparent !important;border:none !important;}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map = L.map('map', { zoomControl: false, attributionControl: false, zoomSnap: 0.5 }).setView([24.7136, 46.6753], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, crossOrigin: true }).addTo(map);
L.control.zoom({ position: 'bottomright' }).addTo(map);
var markers = {};
var line = null;

function makeIcon(emoji, color) {
  var size = 38;
  return L.divIcon({
    className: 'sharek-marker',
    html: '<div style="width:'+size+'px;height:'+size+'px;border-radius:50%;background:'+color+';display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25);">'+emoji+'</div>',
    iconSize: [size, size],
    iconAnchor: [size/2, size/2]
  });
}

window.addEventListener('message', function(event) {
  var msg = event.data || {};
  if (msg.type === 'pickup-locations') window.updateLocations(msg);
  if (msg.type === 'pickup-center') window.centerOn(msg.lat, msg.lng, msg.zoom);
});

window.parent.postMessage({ type: 'pickup-map-ready' }, '*');

window.updateLocations = function(data) {
  if (!data) return;
  var hasDonor = data.donorLat != null && data.donorLng != null;
  var hasClaimer = data.claimerLat != null && data.claimerLng != null;
  var hasFood = data.foodLat != null && data.foodLng != null;

  if (hasDonor) {
    if (!markers.donor) {
      markers.donor = L.marker([data.donorLat, data.donorLng], { icon: makeIcon('🤝', '#FF6B35') }).addTo(map);
    } else { markers.donor.setLatLng([data.donorLat, data.donorLng]); }
  } else if (markers.donor) { map.removeLayer(markers.donor); delete markers.donor; }

  if (hasClaimer) {
    if (!markers.claimer) {
      markers.claimer = L.marker([data.claimerLat, data.claimerLng], { icon: makeIcon('❤️', '#F7564C') }).addTo(map);
    } else { markers.claimer.setLatLng([data.claimerLat, data.claimerLng]); }
  } else if (markers.claimer) { map.removeLayer(markers.claimer); delete markers.claimer; }

  if (hasFood) {
    if (!markers.food) {
      markers.food = L.marker([data.foodLat, data.foodLng], { icon: makeIcon('🍱', '#2E9E5B') }).addTo(map);
    } else { markers.food.setLatLng([data.foodLat, data.foodLng]); }
  } else if (markers.food) { map.removeLayer(markers.food); delete markers.food; }

  if (line) { map.removeLayer(line); line = null; }
  if (hasDonor && hasClaimer) {
    line = L.polyline([[data.donorLat, data.donorLng], [data.claimerLat, data.claimerLng]], {
      color: '#FF6B35', weight: 3, opacity: 0.5, dashArray: '8,8'
    }).addTo(map);
  } else if (hasFood && hasClaimer) {
    line = L.polyline([[data.foodLat, data.foodLng], [data.claimerLat, data.claimerLng]], {
      color: '#2E9E5B', weight: 3, opacity: 0.5, dashArray: '8,8'
    }).addTo(map);
  }

  if (hasDonor && hasClaimer) {
    var bounds = L.latLngBounds([[data.donorLat, data.donorLng], [data.claimerLat, data.claimerLng]]);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  } else if (hasFood) {
    map.flyTo([data.foodLat, data.foodLng], 14, { duration: 0.5 });
  }
};

window.centerOn = function(lat, lng, zoom) {
  map.flyTo([lat, lng], zoom || 14, { duration: 0.8 });
};
</script>
</body>
</html>`;

export default function ChatScreen() {
  const { t, language, user, profile } = useAuth();
  const params = useLocalSearchParams<{ donationId?: string; mealRequestId?: string; matchId?: string; otherUserId: string }>();
  const donationId = params.donationId;
  const mealRequestId = params.mealRequestId;
  const matchId = params.matchId;
  const otherUserId = params.otherUserId;
  const [resolvedOtherId, setResolvedOtherId] = useState<string | null>(null);
  const effectiveOtherId = otherUserId || resolvedOtherId;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [donation, setDonation] = useState<FoodDonation | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [myLocation, setMyLocation] = useState<Coords | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [matchRated, setMatchRated] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const webViewRef = useRef<any>(null);
  const mapRef = useRef<MapView>(null);
  const iframeRef = useRef<any>(null);
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const font = language === 'ar' ? 'Cairo-' : 'Inter-';
  const rtl = language === 'ar';
  const isDonor = donation?.user_id === user?.id;
  const isHelper = match?.helper_id === user?.id;

  const sendMapMessage = useCallback((message: Record<string, unknown>) => {
    if (Platform.OS === 'web') {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(message, '*');
      }
      return;
    }
    const type = message.type;
    if (type === 'pickup-locations') {
      webViewRef.current?.injectJavaScript(`window.updateLocations(${JSON.stringify(message)}); true;`);
    }
    if (type === 'pickup-center') {
      webViewRef.current?.injectJavaScript(`window.centerOn(${message.lat}, ${message.lng}, ${message.zoom ?? 14}); true;`);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'pickup-map-ready') setMapReady(true);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const onWebViewMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'pickup-map-ready') setMapReady(true);
    } catch { /* ignore */ }
  }, []);

  const loadMessages = useCallback(async () => {
    if (!donationId && !mealRequestId) return;
    const scope = donationId ? 'food' : 'request';
    const id = donationId ?? mealRequestId;
    const { items } = await apiFetch<{ items: Message[] }>(`/v1/chat/${scope}/${id}`).catch(() => ({ items: [] as Message[] }));
    if (items) {
      setMessages(items);
      const unread = items.filter(
        (m) => m.recipient_id === user?.id && m.read_at === null
      );
      await Promise.all(unread.map((m) =>
        supabase.rpc('mark_message_read', { p_message_id: m.id })
      ));
    }
    setLoading(false);
  }, [donationId, mealRequestId, user]);

  const loadDonation = useCallback(async () => {
    if (!donationId) return;
    const { data } = await supabase
      .from('food_donations')
      .select('*')
      .eq('id', donationId)
      .maybeSingle();
    if (data) setDonation(data as FoodDonation);
  }, [donationId]);

  const loadOtherProfile = useCallback(async () => {
    if (!otherUserId) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', otherUserId)
      .maybeSingle();
    if (data) setOtherProfile(data as Profile);
  }, [otherUserId]);

  const loadMatch = useCallback(async () => {
    if (!matchId || !user) return;
    const { data } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .maybeSingle();
    if (!data) return;
    const m = data as Match;
    setMatch(m);
    if (!otherUserId) {
      let otherId: string | null = null;
      if (m.helper_id === user.id) {
        const { data: req } = await supabase
          .from('meal_requests')
          .select('user_id')
          .eq('id', m.request_id)
          .maybeSingle();
        otherId = (req as { user_id: string } | null)?.user_id ?? null;
      } else {
        otherId = m.helper_id;
      }
      if (otherId) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', otherId)
          .maybeSingle();
        if (prof) setOtherProfile(prof as Profile);
        setResolvedOtherId(otherId);
      }
    }
  }, [matchId, user, otherUserId]);

  useEffect(() => {
    loadDonation();
    loadMatch();
    loadOtherProfile();
    loadMessages();
  }, [loadDonation, loadMatch, loadOtherProfile, loadMessages]);

  useEffect(() => {
    if (!donationId || !user) return;
    supabase
      .from('food_ratings')
      .select('id')
      .eq('food_donation_id', donationId)
      .eq('rater_id', user.id)
      .maybeSingle()
      .then(({ data }) => setHasRated(!!data));
  }, [donationId, user]);

  useEffect(() => {
    if (!matchId || !user) return;
    supabase
      .from('food_ratings')
      .select('id')
      .eq('match_id', matchId)
      .eq('rater_id', user.id)
      .maybeSingle()
      .then(({ data }) => setMatchRated(!!data));
  }, [matchId, user]);

  useEffect(() => {
    if (!donationId && !mealRequestId) return;
    const channelId = donationId ?? mealRequestId!;
    const channel = supabase
      .channel(`chat_${channelId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: donationId
          ? `food_donation_id=eq.${donationId}`
          : `meal_request_id=eq.${mealRequestId}`,
      }, async (payload) => {
        const newMsg = payload.new as Message;
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        if (newMsg.recipient_id === user?.id && newMsg.read_at === null) {
          await supabase
            .from('messages')
            .update({ read_at: new Date().toISOString() })
            .eq('id', newMsg.id);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [donationId, mealRequestId, user]);

  useEffect(() => {
    if (scrollRef.current && messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const pushMyLocation = useCallback(async (coords: Coords) => {
    if (donationId && donation) {
      if (!['claimed', 'ready_for_pickup'].includes(donation.status)) return;
      if (isDonor) {
        await supabase.rpc('update_donor_location', {
          p_donation_id: donationId, p_lat: coords.latitude, p_lng: coords.longitude,
        });
        if (effectiveOtherId) {
          createNotification(
            effectiveOtherId, 'location_updated',
            language === 'ar' ? 'تم تحديث موقع الشريك' : 'Partner location updated',
            { food_donation_id: donationId, other_user_id: user?.id }, language,
          );
        }
      } else {
        await supabase.rpc('update_claimer_location', {
          p_donation_id: donationId, p_lat: coords.latitude, p_lng: coords.longitude,
        });
        if (effectiveOtherId) {
          createNotification(
            effectiveOtherId, 'location_updated',
            language === 'ar' ? 'تم تحديث موقع المستلم' : 'Requester location updated',
            { food_donation_id: donationId, other_user_id: user?.id }, language,
          );
        }
      }
    } else if (matchId && match) {
      if (match.status !== 'accepted') return;
      if (isHelper) {
        await supabase.rpc('update_helper_location', {
          p_match_id: matchId, p_lat: coords.latitude, p_lng: coords.longitude,
        });
        if (effectiveOtherId) {
          createNotification(
            effectiveOtherId, 'location_updated',
            language === 'ar' ? 'تم تحديث موقع المساعد' : 'Helper location updated',
            { match_id: matchId, other_user_id: user?.id }, language,
          );
        }
      } else {
        await supabase.rpc('update_requester_location', {
          p_match_id: matchId, p_lat: coords.latitude, p_lng: coords.longitude,
        });
        if (effectiveOtherId) {
          createNotification(
            effectiveOtherId, 'location_updated',
            language === 'ar' ? 'تم تحديث موقع الطالب' : 'Requester location updated',
            { match_id: matchId, other_user_id: user?.id }, language,
          );
        }
      }
    }
  }, [donationId, donation, isDonor, matchId, match, isHelper, effectiveOtherId, user, language]);

  const startLocationTracking = useCallback(async () => {
    const ok = await ensureLocationPermission();
    if (!ok) return;
    const coords = await getCurrentLocation();
    if (coords) {
      setMyLocation(coords);
      pushMyLocation(coords);
    }
    if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    locationIntervalRef.current = setInterval(async () => {
      const c = await getCurrentLocation();
      if (c) {
        setMyLocation(c);
        pushMyLocation(c);
      }
    }, 10000);
  }, [pushMyLocation]);

  useEffect(() => {
    if (donation && ['claimed', 'ready_for_pickup'].includes(donation.status)) {
      startLocationTracking();
    } else if (match && match.status === 'accepted') {
      startLocationTracking();
    }
    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
    };
  }, [donation?.status, match?.status, startLocationTracking]);

  useEffect(() => {
    if (!mapReady) return;
    if (donation) {
      const data: Record<string, unknown> = {
        type: 'pickup-locations',
        foodLat: donation.latitude,
        foodLng: donation.longitude,
        donorLat: donation.donor_lat,
        donorLng: donation.donor_lng,
        claimerLat: donation.claimer_lat,
        claimerLng: donation.claimer_lng,
      };
      sendMapMessage(data);
    } else if (match) {
      const data: Record<string, unknown> = {
        type: 'pickup-locations',
        donorLat: match.helper_lat,
        donorLng: match.helper_lng,
        claimerLat: match.requester_lat,
        claimerLng: match.requester_lng,
      };
      sendMapMessage(data);
    }
  }, [mapReady, donation, match, sendMapMessage]);

  useEffect(() => {
    if (!donationId) return;
    const sub = supabase
      .channel(`donation_gps_${donationId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'food_donations',
        filter: `id=eq.${donationId}`,
      }, (payload) => {
        setDonation(payload.new as FoodDonation);
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [donationId]);

  useEffect(() => {
    if (!matchId) return;
    const sub = supabase
      .channel(`match_gps_${matchId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'matches',
        filter: `id=eq.${matchId}`,
      }, (payload) => {
        setMatch(payload.new as Match);
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [matchId]);

  const liveDistance = useMemo(() => {
    if (!donation) return null;
    const donorCoords: Coords | null = donation.donor_lat && donation.donor_lng
      ? { latitude: donation.donor_lat, longitude: donation.donor_lng } : null;
    const claimerCoords: Coords | null = donation.claimer_lat && donation.claimer_lng
      ? { latitude: donation.claimer_lat, longitude: donation.claimer_lng } : null;
    if (donorCoords && claimerCoords) {
      return haversineKm(donorCoords, claimerCoords);
    }
    if (claimerCoords && donation) {
      return haversineKm(claimerCoords, { latitude: donation.latitude, longitude: donation.longitude });
    }
    return null;
  }, [donation]);

  const liveMatchDistance = useMemo(() => {
    if (!match) return null;
    const helperCoords: Coords | null = match.helper_lat && match.helper_lng
      ? { latitude: match.helper_lat, longitude: match.helper_lng } : null;
    const requesterCoords: Coords | null = match.requester_lat && match.requester_lng
      ? { latitude: match.requester_lat, longitude: match.requester_lng } : null;
    if (helperCoords && requesterCoords) {
      return haversineKm(helperCoords, requesterCoords);
    }
    return null;
  }, [match]);

  const distText = (dist: number | null) => {
    if (dist === null) return '—';
    if (dist < 1) return `${Math.round(dist * 1000)} m`;
    return `${dist.toFixed(1)} ${t('km')}`;
  };

  const sendMessage = async () => {
    const body = input.trim();
    if (!body || !user || !effectiveOtherId) return;
    if (!donationId && !mealRequestId) return;
    setSending(true);
    setInput('');
    const scope = donationId ? 'food' : 'request';
    const id = donationId ?? mealRequestId;
    const { error } = await apiPost<any>(`/v1/chat/${scope}/${id}/messages`, {
      recipient_id: effectiveOtherId,
      body,
    }).then(() => ({ error: null })).catch((err) => ({ error: err }));
    setSending(false);
    if (error) {
      setInput(body);
      return;
    }
    createNotification(
      effectiveOtherId,
      'new_chat_message',
      language === 'ar' ? `رسالة جديدة من ${profile?.full_name ?? ''}` : `New message from ${profile?.full_name ?? ''}`,
      {
        food_donation_id: donationId ?? undefined,
        meal_request_id: mealRequestId ?? undefined,
        other_user_id: user.id,
      },
      language,
    );
  };

  const markReadyForPickup = async () => {
    if (!donationId) return;
    setActionBusy(true);
    const { error } = await supabase.rpc('mark_food_ready_for_pickup', { p_donation_id: donationId });
    setActionBusy(false);
    if (error) {
      Alert.alert(t('errorGeneric'));
      return;
    }
    if (effectiveOtherId) {
      createNotification(
        effectiveOtherId,
        'pickup_status_update',
        language === 'ar' ? 'الوجبة جاهزة للاستلام' : 'Meal is ready for pickup',
        { food_donation_id: donationId, other_user_id: user?.id, food_name: donation?.food_name },
        language,
      );
    }
    loadDonation();
  };

  const confirmReceived = async () => {
    if (!donationId) return;
    Alert.alert(
      t('confirmReceived'),
      t('confirmReceivedPrompt'),
      [
        { text: t('back'), style: 'cancel' },
        {
          text: t('confirmYes'),
          onPress: async () => {
            setActionBusy(true);
            const { error } = await supabase.rpc('confirm_food_received', { p_donation_id: donationId });
            setActionBusy(false);
            if (error) {
              Alert.alert(t('errorGeneric'));
              return;
            }
            if (effectiveOtherId) {
              createNotification(
                user?.id ?? '',
                'rating_reminder',
                language === 'ar' ? `قيّم شريكك ${otherProfile?.full_name ?? ''}` : `Rate your partner ${otherProfile?.full_name ?? ''}`,
                { food_donation_id: donationId, other_user_id: effectiveOtherId },
                language,
              );
            }
            loadDonation();
          },
        },
      ],
    );
  };

  const confirmMatchReceived = async () => {
    if (!matchId) return;
    Alert.alert(
      t('confirmReceiptMatch'),
      t('confirmReceiptMatchPrompt'),
      [
        { text: t('back'), style: 'cancel' },
        {
          text: t('confirmYes'),
          onPress: async () => {
            setActionBusy(true);
            const { error } = await supabase.rpc('confirm_match_received', { p_match_id: matchId });
            setActionBusy(false);
            if (error) {
              Alert.alert(t('errorGeneric'));
              return;
            }
            if (effectiveOtherId) {
              createNotification(
                user?.id ?? '',
                'rating_reminder',
                language === 'ar' ? `قيّم شريكك ${otherProfile?.full_name ?? ''}` : `Rate your partner ${otherProfile?.full_name ?? ''}`,
                { match_id: matchId, other_user_id: effectiveOtherId },
                language,
              );
            }
            const { data: updated } = await supabase
              .from('matches')
              .select('*')
              .eq('id', matchId)
              .maybeSingle();
            if (updated) setMatch(updated as Match);
          },
        },
      ],
    );
  };

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const formatPickupTime = (iso: string) => {
    const d = new Date(iso);
    let h = d.getHours();
    const m = d.getMinutes();
    const period = language === 'ar' ? (h >= 12 ? 'م' : 'ص') : (h >= 12 ? 'PM' : 'AM');
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, '0')} ${period}`;
  };

  const statusLabel = (status: FoodDonationStatus): string => {
    const map: Record<string, string> = {
      available: t('statusAvailable'),
      claimed: t('statusClaimed'),
      ready_for_pickup: t('statusReadyForPickup'),
      received: t('statusReceived'),
      completed: t('statusCompleted'),
      expired: t('statusExpired'),
    };
    return map[status] ?? status;
  };

  const statusColor = (status: FoodDonationStatus): string => {
    const map: Record<string, string> = {
      available: colors.green,
      claimed: colors.primary,
      ready_for_pickup: colors.warning,
      received: colors.coral,
      completed: colors.greenDark,
      expired: colors.brownMuted,
    };
    return map[status] ?? colors.brownMuted;
  };

  const WebView = (props: any) => <View style={props.style} />;
  const showPickupMap = (donation && ['claimed', 'ready_for_pickup'].includes(donation.status)) || (match && match.status === 'accepted');
  const showPickupActions = donation && ['claimed', 'ready_for_pickup'].includes(donation.status);
  const showMatchActions = match && match.status === 'accepted' && !isHelper;
  const showMatchCompleted = match && match.status === 'completed';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
          <Text style={styles.backArrow}>{rtl ? '›' : '‹'}</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatar}>
            <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>
              {otherProfile?.full_name?.charAt(0).toUpperCase() ?? '?'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]} numberOfLines={1}>
              {otherProfile?.full_name ?? '...'}
            </Text>
            {otherProfile?.is_verified && <VerifiedBadge language={language} size={16} />}
            {otherProfile && (otherProfile.contributor_level ?? 0) > 0 && (
              <AchievementBadgeMini level={otherProfile.contributor_level ?? 0} size={14} />
            )}
            {donation && (
              <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]} numberOfLines={1}>
                {donation.food_name} · {donation.meals} {t('meals')}
              </Text>
            )}
          </View>
          {donation && (
            <View style={[styles.statusBadge, { backgroundColor: statusColor(donation.status) + '20' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor(donation.status) }]} />
              <Text style={[typography.micro, { color: statusColor(donation.status), fontFamily: `${font}Bold` }]}>
                {statusLabel(donation.status)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {donation && (
        <View style={styles.foodBanner}>
          {getPrimaryFoodImage(donation) ? (
            <Image source={{ uri: getPrimaryFoodImage(donation)! }} style={styles.foodBannerImg} />
          ) : (
            <View style={[styles.foodBannerImg, { backgroundColor: colors.greenBg, justifyContent: 'center', alignItems: 'center' }]}>
              <UtensilsCrossed size={20} color={colors.green} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
              {t('foodItem')}
            </Text>
            <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]} numberOfLines={1}>
              {donation.food_name}
            </Text>
            {donation.description ? (
              <Text style={[typography.micro, { color: colors.brownMuted, fontFamily: `${font}Regular` }]} numberOfLines={2}>
                {donation.description}
              </Text>
            ) : null}
            {donation.pickup_start && donation.pickup_end && (
              <View style={styles.pickupTimeRow}>
                <Clock size={11} color={colors.warning} />
                <Text style={[typography.micro, { color: colors.warning, fontFamily: `${font}SemiBold` }]}>
                  {t('pickupWindow')}: {formatPickupTime(donation.pickup_start)} - {formatPickupTime(donation.pickup_end)}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.mealsBadge}>
            <Text style={[typography.micro, { color: colors.greenDark, fontFamily: `${font}Bold` }]}>
              {donation.meals} {t('meals')}
            </Text>
          </View>
        </View>
      )}

      {/* Pickup GPS Map */}
      {showPickupMap && (
        <View style={styles.pickupMapWrap}>
          <View style={styles.pickupMapHeader}>
            <View style={styles.pickupMapTitleRow}>
              <Navigation size={16} color={colors.primary} />
              <Text style={[typography.small, { color: colors.brown, fontFamily: `${font}Bold` }]}>
                {t('liveGpsTracking')}
              </Text>
            </View>
            {liveDistance !== null && (
              <View style={styles.liveDistBadge}>
                <MapPin size={12} color={colors.greenDark} />
                <Text style={[typography.micro, { color: colors.greenDark, fontFamily: `${font}Bold` }]}>
                  {t('distanceBetweenYou')}: {distText(liveDistance)}
                </Text>
              </View>
            )}
            {liveMatchDistance !== null && (
              <View style={styles.liveDistBadge}>
                <MapPin size={12} color={colors.greenDark} />
                <Text style={[typography.micro, { color: colors.greenDark, fontFamily: `${font}Bold` }]}>
                  {t('distanceBetweenYou')}: {distText(liveMatchDistance)}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.pickupMapBox}>
            {Platform.OS === 'web' ? (
              React.createElement('iframe', {
                ref: (node: any) => { iframeRef.current = node; },
                title: 'SHARek pickup map',
                srcDoc: PICKUP_MAP_HTML,
                style: { border: 0, width: '100%', height: '100%', display: 'block' },
                onLoad: () => setMapReady(true),
                allow: 'geolocation',
              })
            ) : (
              <WebView
                ref={webViewRef}
                source={{ html: PICKUP_MAP_HTML }}
                style={styles.pickupMap}
                originWhitelist={['*']}
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
                onMessage={onWebViewMessage}
                renderLoading={() => <View style={styles.mapLoading}><ActivityIndicator color={colors.primary} size="small" /></View>}
              />
            )}
          </View>
          <View style={styles.mapLegend}>
            {match ? (
              <>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#FF6B35' }]} />
                  <Text style={[typography.micro, { color: colors.brown, fontFamily: `${font}SemiBold` }]}>
                    {isHelper ? t('myLocation') : t('navigateToDonor')}
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#F7564C' }]} />
                  <Text style={[typography.micro, { color: colors.brown, fontFamily: `${font}SemiBold` }]}>
                    {isHelper ? t('navigateToRequester') : t('myLocation')}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#FF6B35' }]} />
                  <Text style={[typography.micro, { color: colors.brown, fontFamily: `${font}SemiBold` }]}>
                    {isDonor ? t('myLocation') : t('donorLocationLive')}
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#F7564C' }]} />
                  <Text style={[typography.micro, { color: colors.brown, fontFamily: `${font}SemiBold` }]}>
                    {isDonor ? t('claimerLocation') : t('myLocation')}
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#2E9E5B' }]} />
                  <Text style={[typography.micro, { color: colors.brown, fontFamily: `${font}SemiBold` }]}>
                    {t('markerFood')}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      )}

      {/* Pickup Status Actions */}
      {showPickupActions && (
        <View style={styles.pickupActions}>
          {isDonor && donation?.status === 'claimed' && (
            <TouchableOpacity
              style={styles.pickupActionBtn}
              onPress={markReadyForPickup}
              disabled={actionBusy}
              activeOpacity={0.8}
            >
              {actionBusy ? <ActivityIndicator color={colors.white} size={18} /> : (
                <>
                  <Package size={20} color={colors.white} />
                  <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>
                    {t('markReadyForPickup')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {!isDonor && donation?.status === 'claimed' && (
            <View style={styles.waitingNotice}>
              <Clock size={18} color={colors.warning} />
              <Text style={[typography.small, { color: colors.brown, fontFamily: `${font}Regular` }]}>
                {t('waitingDonorReady')}
              </Text>
            </View>
          )}
          {!isDonor && donation?.status === 'ready_for_pickup' && (
            <TouchableOpacity
              style={[styles.pickupActionBtn, { backgroundColor: colors.green }]}
              onPress={confirmReceived}
              disabled={actionBusy}
              activeOpacity={0.8}
            >
              {actionBusy ? <ActivityIndicator color={colors.white} size={18} /> : (
                <>
                  <CheckCircle2 size={20} color={colors.white} />
                  <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>
                    {t('confirmReceived')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {isDonor && donation?.status === 'ready_for_pickup' && (
            <View style={styles.waitingNotice}>
              <CheckCircle2 size={18} color={colors.green} />
              <Text style={[typography.small, { color: colors.brown, fontFamily: `${font}Regular` }]}>
                {t('foodReadyForPickup')} · {t('foodReadyDesc')}
              </Text>
            </View>
          )}
        </View>
      )}

      {donation?.status === 'completed' && (
        <View style={styles.completedBanner}>
          <CheckCircle2 size={24} color={colors.green} />
          <Text style={[typography.bodyBold, { color: colors.greenDark, fontFamily: `${font}Bold` }]}>
            {t('pickupCompleted')}
          </Text>
        </View>
      )}

      {donation?.status === 'completed' && !isDonor && !hasRated && (
        <View style={styles.ratingPrompt}>
          <View style={styles.ratingPromptInfo}>
            <Star size={20} color={colors.golden} fill={colors.golden} />
            <Text style={[typography.small, { color: colors.brown, fontFamily: `${font}Regular`, flex: 1 }]}>
              {t('foodReceivedDesc')}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.rateNowBtn}
            onPress={() => setShowRating(true)}
            activeOpacity={0.8}
          >
            <Star size={16} color={colors.white} fill={colors.white} />
            <Text style={[typography.small, { color: colors.white, fontFamily: `${font}Bold` }]}>
              {t('rateNow')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {donation?.status === 'completed' && !isDonor && hasRated && (
        <View style={styles.completedBanner}>
          <Star size={20} color={colors.golden} fill={colors.golden} />
          <Text style={[typography.small, { color: colors.brown, fontFamily: `${font}SemiBold` }]}>
            {t('alreadyRated')}
          </Text>
        </View>
      )}

      {showMatchActions && (
        <View style={styles.pickupActions}>
          <TouchableOpacity
            style={[styles.pickupActionBtn, { backgroundColor: colors.green }]}
            onPress={confirmMatchReceived}
            disabled={actionBusy}
            activeOpacity={0.8}
          >
            {actionBusy ? <ActivityIndicator color={colors.white} size={18} /> : (
              <>
                <CheckCircle2 size={20} color={colors.white} />
                <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>
                  {t('confirmReceiptMatch')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {showMatchCompleted && (
        <View style={styles.completedBanner}>
          <CheckCircle2 size={24} color={colors.green} />
          <Text style={[typography.bodyBold, { color: colors.greenDark, fontFamily: `${font}Bold` }]}>
            {t('matchCompletedTitle')}
          </Text>
        </View>
      )}

      {showMatchCompleted && !matchRated && (
        <View style={styles.ratingPrompt}>
          <View style={styles.ratingPromptInfo}>
            <Star size={20} color={colors.golden} fill={colors.golden} />
            <Text style={[typography.small, { color: colors.brown, fontFamily: `${font}Regular`, flex: 1 }]}>
              {t('rateExperience')}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.rateNowBtn}
            onPress={() => setShowRating(true)}
            activeOpacity={0.8}
          >
            <Star size={16} color={colors.white} fill={colors.white} />
            <Text style={[typography.small, { color: colors.white, fontFamily: `${font}Bold` }]}>
              {t('ratePartnerNow')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {showMatchCompleted && matchRated && (
        <View style={styles.completedBanner}>
          <Star size={20} color={colors.golden} fill={colors.golden} />
          <Text style={[typography.small, { color: colors.brown, fontFamily: `${font}SemiBold` }]}>
            {t('alreadyRated')}
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.messagesScroll}
            contentContainerStyle={{ paddingVertical: spacing.md, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
          >
            {messages.length === 0 ? (
              <View style={styles.emptyChat}>
                <MessageCircle size={40} color={colors.brownMuted} />
                <Text style={[typography.body, { color: colors.brownMuted, marginTop: spacing.md, textAlign: 'center', fontFamily: `${font}Regular` }]}>
                  {t('noMessages')}
                </Text>
              </View>
            ) : (
              messages.map((msg) => {
                const isMine = msg.sender_id === user?.id;
                return (
                  <View
                    key={msg.id}
                    style={[styles.msgBubble, isMine ? styles.msgMine : styles.msgTheirs]}
                  >
                    <Text style={[
                      typography.body,
                      { color: isMine ? colors.white : colors.brown, fontFamily: `${font}Regular` },
                    ]}>
                      {msg.body}
                    </Text>
                    <Text style={[
                      typography.micro,
                      { color: isMine ? 'rgba(255,255,255,0.7)' : colors.brownMuted, marginTop: 2, alignSelf: 'flex-end', fontFamily: `${font}Regular` },
                    ]}>
                      {fmtTime(msg.created_at)}
                    </Text>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder={t('typeMessage')}
            value={input}
            onChangeText={setInput}
            placeholderTextColor={colors.brownMuted}
            multiline
            maxLength={500}
            editable={!loading}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.4 }]}
            onPress={sendMessage}
            disabled={!input.trim() || sending}
            activeOpacity={0.7}
          >
            {sending ? <ActivityIndicator color={colors.white} size={18} /> : <Send size={20} color={colors.white} />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <RatingModal
        visible={showRating}
        donationId={donationId ?? null}
        matchId={matchId ?? null}
        partnerName={otherProfile?.full_name ?? ''}
        language={language}
        t={t}
        onClose={() => setShowRating(false)}
        onSubmitted={() => {
          setHasRated(true);
          setMatchRated(true);
          loadOtherProfile();
        }}
      />
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
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  foodBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderColor: colors.border,
  },
  foodBannerImg: { width: 40, height: 40, borderRadius: radius.sm },
  pickupTimeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2,
  },
  mealsBadge: {
    backgroundColor: colors.greenBg, borderRadius: radius.pill,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  pickupMapWrap: {
    backgroundColor: colors.surface, borderBottomWidth: 1.5, borderColor: colors.border,
    paddingBottom: spacing.sm,
  },
  pickupMapHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  pickupMapTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveDistBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.greenBg, borderRadius: radius.pill,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  pickupMapBox: {
    height: MAP_HEIGHT, marginHorizontal: spacing.md,
    borderRadius: radius.md, overflow: 'hidden',
    borderWidth: 1.5, borderColor: colors.border,
  },
  pickupMap: { flex: 1 },
  mapLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surfaceAlt },
  mapLegend: {
    flexDirection: 'row', justifyContent: 'center', gap: spacing.md,
    paddingTop: spacing.xs,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  pickupActions: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceAlt, borderBottomWidth: 1.5, borderColor: colors.border,
  },
  pickupActionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: spacing.md,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 3,
  },
  waitingNotice: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1.5, borderColor: colors.border,
  },
  completedBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.greenBg, paddingVertical: spacing.md,
    borderBottomWidth: 1.5, borderColor: colors.border,
  },
  ratingPrompt: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.warningBg, borderBottomWidth: 1.5, borderColor: colors.border,
    gap: spacing.sm,
  },
  ratingPromptInfo: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  rateNowBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.goldenDark, borderRadius: radius.lg, paddingVertical: spacing.sm,
  },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messagesScroll: { flex: 1, paddingHorizontal: spacing.md },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },
  msgBubble: {
    maxWidth: '78%', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  msgMine: {
    backgroundColor: colors.primary, alignSelf: 'flex-end',
    borderBottomRightRadius: radius.sm,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 2,
  },
  msgTheirs: {
    backgroundColor: colors.surfaceAlt, alignSelf: 'flex-start',
    borderBottomLeftRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderTopWidth: 1.5, borderColor: colors.border,
  },
  textInput: {
    ...typography.body, color: colors.brown,
    flex: 1, maxHeight: 100, minHeight: 40,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    borderWidth: 1.5, borderColor: colors.border,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 3,
  },
});

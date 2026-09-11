import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ActivityIndicator,
  TextInput, ScrollView, Image, Animated, Platform, Alert, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';
import {
  Heart, HandHeart, MapPin, LocateFixed, Search, X,
  Clock, UtensilsCrossed, CheckCircle2, Navigation, Sliders,
  MessageCircle,
} from 'lucide-react-native';
import { supabase, MealRequest, FoodDonation } from '@/lib/supabase';
import { router } from 'expo-router';
import { ensureLocationPermission, getCurrentLocation, haversineKm, Coords } from '@/lib/location';
import { apiFetch, apiPost } from '@/lib/api';

type FilterType = 'all' | 'requests' | 'food';
type SelectedItem =
  | { type: 'request'; id: string }
  | { type: 'food'; id: string }
  | null;

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCREEN_WIDTH = Dimensions.get('window').width;
const isTablet = SCREEN_WIDTH >= 768;
const MAP_HEIGHT = isTablet ? 380 : Math.max(300, Math.min(430, SCREEN_HEIGHT * 0.38));

const LEAFLET_HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#FFF8F0;}
.sharek-marker{background:transparent !important;border:none !important;}
.sharek-user-pulse{
  width:20px;height:20px;border-radius:50%;background:#2E9E5B;
  border:3px solid white;box-shadow:0 0 0 2px rgba(46,158,91,0.3);
}
.sharek-marker-active{
  filter:drop-shadow(0 0 8px rgba(255,107,53,0.6));
  transform:scale(1.2);
  transition:transform 0.2s ease;
}
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
var userMarker = null;
var mapReady = false;

window.addEventListener('message', function(event) {
  var message = event.data || {};
  if (message.type === 'map-update') window.updateMarkers(message.data);
  if (message.type === 'map-location') window.updateUserLocation(message.lat, message.lng);
  if (message.type === 'map-center') window.centerOn(message.lat, message.lng, message.zoom);
  if (message.type === 'map-pan') window.panTo(message.lat, message.lng);
  if (message.type === 'map-highlight') window.highlightMarker(message.itemType, message.id);
});

function makeIcon(emoji, color, isActive) {
  var size = isActive ? 46 : 38;
  var ring = isActive ? 'box-shadow:0 0 0 4px rgba(255,107,53,0.25);' : 'box-shadow:0 2px 8px rgba(0,0,0,0.25);';
  return L.divIcon({
    className: 'sharek-marker',
    html: '<div style="width:'+size+'px;height:'+size+'px;border-radius:50%;background:'+color+';display:flex;align-items:center;justify-content:center;font-size:'+(isActive?22:18)+'px;border:2px solid white;'+ring+'transition:all 0.2s ease;">'+emoji+'</div>',
    iconSize: [size, size],
    iconAnchor: [size/2, size/2]
  });
}

window.updateMarkers = function(data) {
  if (!data) return;
  var seen = {};
  (data.requests || []).forEach(function(r) {
    var key = 'r_' + r.id;
    seen[key] = true;
    if (!markers[key]) {
      var m = L.marker([r.latitude, r.longitude], { icon: makeIcon('❤️', '#F7564C', false), riseOnHover: true });
      m.on('click', function() {
        var msg = JSON.stringify({type:'tap',itemType:'request',id:r.id});
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(msg);
        window.parent && window.parent.postMessage({type:'tap',itemType:'request',id:r.id}, '*');
      });
      m.addTo(map);
      markers[key] = m;
    } else {
      markers[key].setLatLng([r.latitude, r.longitude]);
    }
  });
  (data.donations || []).forEach(function(d) {
    var key = 'd_' + d.id;
    seen[key] = true;
    if (!markers[key]) {
      var m = L.marker([d.latitude, d.longitude], { icon: makeIcon('🍱', '#2E9E5B', false), riseOnHover: true });
      m.on('click', function() {
        var msg = JSON.stringify({type:'tap',itemType:'food',id:d.id});
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(msg);
        window.parent && window.parent.postMessage({type:'tap',itemType:'food',id:d.id}, '*');
      });
      m.addTo(map);
      markers[key] = m;
    } else {
      markers[key].setLatLng([d.latitude, d.longitude]);
    }
  });
  Object.keys(markers).forEach(function(key) {
    if (!seen[key]) { map.removeLayer(markers[key]); delete markers[key]; }
  });
};

window.parent.postMessage({ type: 'map-ready' }, '*');

window.highlightMarker = function(itemType, id) {
  Object.keys(markers).forEach(function(key) {
    var parts = key.split('_');
    var kType = parts[0] === 'r' ? 'request' : 'food';
    var kId = parts.slice(1).join('_');
    var isActive = kType === itemType && kId === id;
    var emoji = kType === 'request' ? '❤️' : '🍱';
    var color = kType === 'request' ? '#F7564C' : '#2E9E5B';
    markers[key].setIcon(makeIcon(emoji, color, isActive));
  });
};

window.updateUserLocation = function(lat, lng) {
  if (userMarker) {
    userMarker.setLatLng([lat, lng]);
  } else {
    userMarker = L.marker([lat, lng], { icon: L.divIcon({ className: 'sharek-marker', html: '<div class="sharek-user-pulse"></div>', iconSize: [20,20], iconAnchor: [10,10] }), zIndexOffset: 1000 }).addTo(map);
  }
};

window.centerOn = function(lat, lng, zoom) {
  map.flyTo([lat, lng], zoom || 14, { duration: 0.8 });
};

window.panTo = function(lat, lng) {
  map.panTo([lat, lng], { animate: true, duration: 0.5 });
};
</script>
</body>
</html>`;

function timeAgo(iso: string, lang: 'ar' | 'en'): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return lang === 'ar' ? 'الآن' : 'just now';
  if (mins < 60) return lang === 'ar' ? `قبل ${mins} ${lang === 'ar' ? 'دقيقة' : 'min'}` : `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ${lang === 'ar' ? 'ساعة' : 'hr'}${lang === 'ar' ? '' : ' ago'}`;
  const days = Math.floor(hrs / 24);
  return `${days} ${lang === 'ar' ? 'يوم' : 'd'}${lang === 'ar' ? '' : ' ago'}`;
}

function timeUntil(iso: string, lang: 'ar' | 'en'): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return lang === 'ar' ? 'منتهي' : 'expired';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} ${lang === 'ar' ? 'دقيقة' : 'min'}`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} ${lang === 'ar' ? 'ساعة' : 'hr'}`;
}

function LiveCountdown({ iso, lang, style }: { iso: string; lang: 'ar' | 'en'; style?: any }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) {
    return <Text style={style}>{lang === 'ar' ? 'منتهي' : 'expired'}</Text>;
  }
  const totalSec = Math.floor(diff / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const label = hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
  return <Text style={style}>{label}</Text>;
}

export default function MapScreen() {
  const { t, language, user, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [location, setLocation] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(true);
  const [requests, setRequests] = useState<MealRequest[]>([]);
  const [donations, setDonations] = useState<FoodDonation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selected, setSelected] = useState<SelectedItem>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [claimedDonation, setClaimedDonation] = useState<FoodDonation | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const iframeRef = useRef<any>(null);
  const bottomAnim = useRef(new Animated.Value(0)).current;
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';

  const runMapScript = useCallback((script: string, message?: Record<string, unknown>) => {
    if (Platform.OS === 'web') {
      if (iframeRef.current?.contentWindow && message) {
        iframeRef.current.contentWindow.postMessage(message, '*');
      }
      return;
    }
    webViewRef.current?.injectJavaScript(`${script}; true;`);
  }, []);

  const sendMapMessage = useCallback((message: Record<string, unknown>) => {
    if (Platform.OS === 'web') {
      runMapScript('', message);
      return;
    }
    const type = message.type;
    if (type === 'map-update') runMapScript(`window.updateMarkers(${JSON.stringify(message.data)})`);
    if (type === 'map-location') runMapScript(`window.updateUserLocation(${message.lat}, ${message.lng})`);
    if (type === 'map-center') runMapScript(`window.centerOn(${message.lat}, ${message.lng}, ${message.zoom ?? 14})`);
    if (type === 'map-pan') runMapScript(`window.panTo(${message.lat}, ${message.lng})`);
    if (type === 'map-highlight') runMapScript(`window.highlightMarker(${JSON.stringify(message.itemType)}, ${JSON.stringify(message.id)})`);
  }, [runMapScript]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'map-ready') setMapReady(true);
      if (event.data?.type === 'tap') {
        showBottomCard({ type: event.data.itemType, id: event.data.id });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const loadLocation = useCallback(async () => {
    setLocating(true);
    const ok = await ensureLocationPermission();
    if (ok) {
      const coords = await getCurrentLocation();
      if (coords) {
        setLocation(coords);
        sendMapMessage({ type: 'map-location', lat: coords.latitude, lng: coords.longitude });
        sendMapMessage({ type: 'map-center', lat: coords.latitude, lng: coords.longitude, zoom: 14 });
      }
    }
    setLocating(false);
  }, [sendMapMessage]);

  const loadData = useCallback(async () => {
    if (!location) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setDataError(false);
    try {
      const { items: nearby } = await apiFetch<{ items: Array<{ item_type: 'request' | 'food'; item_id: string }> }>(
        `/v1/map/nearby?latitude=${encodeURIComponent(location.latitude)}&longitude=${encodeURIComponent(location.longitude)}&radius_km=25`,
      );
      const requestIds = nearby.filter(item => item.item_type === 'request').map(item => item.item_id);
      const foodIds = nearby.filter(item => item.item_type === 'food').map(item => item.item_id);
      const [r, f] = await Promise.all([
        requestIds.length
          ? supabase.rpc('get_nearby_request_details', { p_ids: requestIds })
          : Promise.resolve({ data: [], error: null }),
        foodIds.length
          ? supabase.rpc('get_nearby_food_details', { p_ids: foodIds })
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (r.error || f.error) throw new Error('Unable to load nearby details');
      if (r.data) setRequests(r.data as MealRequest[]);
      if (f.data) setDonations(f.data as FoodDonation[]);
    } catch {
      setRequests([]);
      setDonations([]);
      setDataError(true);
    } finally {
      setLoading(false);
    }
  }, [location]);

  useEffect(() => {
    loadLocation();
    loadData();
    supabase.rpc('expire_food_donations').then(({ error }) => {
      if (!error) loadData();
    });
    const sub = supabase
      .channel('map_live_v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_requests' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_donations' }, loadData)
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [loadLocation, loadData]);

  const nearbyRequests = useMemo(() => location
    ? requests.filter(r => haversineKm(location, { latitude: r.latitude, longitude: r.longitude }) <= 25)
    : [], [requests, location]);
  const nearbyDonations = useMemo(() => location
    ? donations.filter(d => haversineKm(location, { latitude: d.latitude, longitude: d.longitude }) <= 25)
    : [], [donations, location]);

  useEffect(() => {
    sendMapMessage({ type: 'map-update', data: { requests: nearbyRequests, donations: nearbyDonations } });
  }, [nearbyRequests, nearbyDonations, sendMapMessage, mapReady]);

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setDonations(current => current.filter(d => new Date(d.expires_at).getTime() > now));
    }, 1_000);
    return () => clearInterval(id);
  }, []);

  const showBottomCard = useCallback((item: SelectedItem) => {
    setSelected(item);
    setActionResult(null);
    Animated.spring(bottomAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }).start();
    if (item) {
      sendMapMessage({ type: 'map-highlight', itemType: item.type, id: item.id });
      const target = item.type === 'request'
        ? requests.find(r => r.id === item.id)
        : donations.find(d => d.id === item.id);
      if (target) {
        sendMapMessage({ type: 'map-pan', lat: target.latitude, lng: target.longitude });
      }
    }
  }, [requests, donations, bottomAnim, sendMapMessage]);

  const hideBottomCard = useCallback(() => {
    Animated.timing(bottomAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    sendMapMessage({ type: 'map-highlight', itemType: null, id: null });
    setTimeout(() => setSelected(null), 200);
  }, [bottomAnim, sendMapMessage]);

  const onWebViewMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'tap') {
        showBottomCard({ type: msg.itemType, id: msg.id } as SelectedItem);
      }
    } catch { /* ignore */ }
  }, [showBottomCard]);

  const filteredRequests = useMemo(() => {
    return nearbyRequests.filter(r => {
      if (filter === 'food') return false;
      if (search) {
        const s = search.toLowerCase();
        return `${r.meals} ${r.timing}`.toLowerCase().includes(s);
      }
      return true;
    });
  }, [nearbyRequests, filter, search]);

  const filteredDonations = useMemo(() => {
    return nearbyDonations.filter(d => {
      if (filter === 'requests') return false;
      if (search) {
        const s = search.toLowerCase();
        return d.food_name.toLowerCase().includes(s) || d.description.toLowerCase().includes(s);
      }
      return true;
    });
  }, [nearbyDonations, filter, search]);

  const sortedItems = useMemo(() => {
    const items: Array<{
      key: string;
      type: 'request' | 'food';
      data: MealRequest | FoodDonation;
      dist: number | null;
    }> = [
      ...filteredRequests.map(r => ({
        key: `r_${r.id}`, type: 'request' as const, data: r,
        dist: location ? haversineKm(location, { latitude: r.latitude, longitude: r.longitude }) : null,
      })),
      ...filteredDonations.map(d => ({
        key: `d_${d.id}`, type: 'food' as const, data: d,
        dist: location ? haversineKm(location, { latitude: d.latitude, longitude: d.longitude }) : null,
      })),
    ];
    return items.sort((a, b) => (a.dist ?? 9999) - (b.dist ?? 9999));
  }, [filteredRequests, filteredDonations, location]);

  const acceptRequest = async (req: MealRequest) => {
    if (!user || !location) {
      Alert.alert(t('locationError'));
      return;
    }
    setActionBusy(true);
    const { error: offerErr } = await apiPost<{ id: string }>(`/v1/meal-requests/${req.id}/offers`, {
      latitude: location.latitude,
      longitude: location.longitude,
    }).then(() => ({ error: null })).catch((error) => ({ error }));
    setActionBusy(false);
    if (offerErr) {
      Alert.alert(t('errorGeneric'));
      return;
    }
    setActionResult(t('offerSent'));
    setTimeout(() => { hideBottomCard(); loadData(); }, 1500);
  };

  const claimFood = async (donation: FoodDonation) => {
    if (!user) return;
    setActionBusy(true);
    const { error } = await apiPost<{ id: string }>(`/v1/food-donations/${donation.id}/claim`, location ? {
      latitude: location.latitude,
      longitude: location.longitude,
    } : undefined)
      .then(() => ({ error: null })).catch((error) => ({ error }));
    setActionBusy(false);
    if (error) {
      Alert.alert(t('errorGeneric'));
      return;
    }
    setActionResult(t('claimSuccess'));
    setClaimedDonation(donation);
    setTimeout(() => { loadData(); }, 1500);
  };

  const distText = (dist: number | null) => {
    if (dist === null) return '';
    if (dist < 1) return `${Math.round(dist * 1000)} m`;
    return `${dist.toFixed(1)} ${t('km')}`;
  };

  const selectedRequest = selected?.type === 'request' ? requests.find(r => r.id === selected.id) : null;
  const selectedDonation = selected?.type === 'food' ? donations.find(d => d.id === selected.id) : null;

  const suggestedDonations = useMemo(() => {
    return donations
      .map(d => ({
        donation: d,
        dist: location ? haversineKm(location, { latitude: d.latitude, longitude: d.longitude }) : null,
      }))
      .filter(x => x.dist === null || x.dist <= 25)
      .sort((a, b) => (a.dist ?? 9999) - (b.dist ?? 9999))
      .slice(0, 10);
  }, [donations, location]);

  const FilterChip = ({ type, label, icon }: { type: FilterType; label: string; icon: React.ReactNode }) => (
    <TouchableOpacity
      style={[styles.chip, filter === type && styles.chipActive]}
      onPress={() => setFilter(type)}
      activeOpacity={0.7}
    >
      {icon}
      <Text style={[styles.chipText, filter === type && styles.chipTextActive, { fontFamily: `${font}SemiBold` }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: (selected ? 300 : spacing.xxl) + insets.bottom }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <View style={styles.logoCenter}>
          <Image source={require('../../assets/images/image copy.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <TouchableOpacity onPress={loadLocation} disabled={locating} style={styles.refreshBtn} activeOpacity={0.7}>
          {locating ? <ActivityIndicator color={colors.primary} size={16} /> : <LocateFixed size={20} color={colors.primary} />}
        </TouchableOpacity>
      </View>

      <View style={styles.quickActions}>
        <TouchableOpacity style={[styles.quickAction, styles.requestAction]} onPress={() => router.push('/(tabs)/request')} activeOpacity={0.85}>
          <Heart size={21} color={colors.white} fill={colors.white} />
          <Text style={[styles.quickActionText, { fontFamily: `${font}Bold` }]}>اطلب وجبة الآن</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickAction, styles.shareAction]} onPress={() => router.push('/(tabs)/donate')} activeOpacity={0.85}>
          <UtensilsCrossed size={21} color={colors.white} />
          <Text style={[styles.quickActionText, { fontFamily: `${font}Bold` }]}>شارك طعام الآن</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search size={18} color={colors.brownMuted} />
          <TextInput
            style={[styles.searchInput, { fontFamily: `${font}Regular` }]}
            placeholder={t('searchMap')}
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={colors.brownMuted}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={16} color={colors.brownMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.filterRow}>
        <FilterChip type="all" label={t('filterAll')} icon={<Sliders size={14} color={filter === 'all' ? colors.white : colors.brownMuted} />} />
        <FilterChip type="requests" label={t('filterRequests')} icon={<Heart size={14} color={filter === 'requests' ? colors.white : colors.coral} />} />
        <FilterChip type="food" label={t('filterFood')} icon={<UtensilsCrossed size={14} color={filter === 'food' ? colors.white : colors.green} />} />
      </View>

      <View style={styles.mapWrap}>
        {Platform.OS === 'web' ? (
          React.createElement('iframe', {
            ref: (node: any) => { iframeRef.current = node; },
            title: 'SHARek live map',
            srcDoc: LEAFLET_HTML,
            style: { border: 0, width: '100%', height: '100%', display: 'block' },
            onLoad: () => setMapReady(true),
            allow: 'geolocation',
          })
        ) : (
          <WebView
            ref={webViewRef}
            source={{ html: LEAFLET_HTML }}
            style={styles.map}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            onMessage={onWebViewMessage}
            renderLoading={() => <View style={styles.mapLoading}><ActivityIndicator color={colors.primary} size="large" /></View>}
          />
        )}
        {locating && (
          <View style={styles.locatingOverlay}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>{t('locating')}</Text>
          </View>
        )}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.coral }]} />
            <Text style={[styles.legendText, { fontFamily: `${font}SemiBold` }]}>{t('markerRequest')}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.green }]} />
            <Text style={[styles.legendText, { fontFamily: `${font}SemiBold` }]}>{t('markerFood')}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.green, borderColor: colors.white, borderWidth: 2 }]} />
            <Text style={[styles.legendText, { fontFamily: `${font}SemiBold` }]}>{t('myLocation')}</Text>
          </View>
        </View>
      </View>

      {profile?.role === 'needer' && (
        <View style={styles.suggestedSection}>
          <Text style={[typography.heading, { color: colors.brown, marginBottom: spacing.sm, fontFamily: `${font}Bold` }]}>
            {t('suggestedMeals')}
          </Text>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: spacing.md }} />
          ) : suggestedDonations.length === 0 ? (
            <View style={styles.suggestedEmpty}>
              <UtensilsCrossed size={32} color={colors.brownMuted} />
              <Text style={[typography.small, { color: colors.brownMuted, marginTop: spacing.xs, fontFamily: `${font}Regular` }]}>
                {t('noNearbyFood')}
              </Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: spacing.lg }}>
              {suggestedDonations.map(({ donation, dist }) => (
                <View key={donation.id} style={styles.suggestedCard}>
                  {donation.image_url ? (
                    <Image source={{ uri: donation.image_url }} style={styles.suggestedImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.suggestedImage, styles.suggestedImagePlaceholder]}>
                      <UtensilsCrossed size={26} color={colors.brownMuted} />
                    </View>
                  )}
                  <View style={styles.suggestedBody}>
                    <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]} numberOfLines={1}>
                      {donation.food_name}
                    </Text>
                    <Text style={[typography.micro, { color: colors.brownMuted, fontFamily: `${font}Regular` }]} numberOfLines={1}>
                      {donation.meals} {t('meals')} {t('available')}
                    </Text>
                    <View style={styles.suggestedMeta}>
                      <View style={styles.suggestedDistBadge}>
                        <Navigation size={10} color={colors.greenDark} />
                        <Text style={[typography.micro, { color: colors.greenDark, fontFamily: `${font}SemiBold` }]}>
                          {distText(dist)}
                        </Text>
                      </View>
                      <View style={styles.suggestedExpiryBadge}>
                        <Clock size={10} color={colors.warning} />
                        <LiveCountdown
                          iso={donation.expires_at}
                          lang={language}
                          style={[typography.micro, { color: colors.warning, fontFamily: `${font}SemiBold` }]}
                        />
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.getItBtn}
                      onPress={() => claimFood(donation)}
                      disabled={actionBusy}
                      activeOpacity={0.8}
                    >
                      {actionBusy ? <ActivityIndicator color={colors.white} size={14} /> : (
                        <Text style={[typography.small, { color: colors.white, fontFamily: `${font}Bold` }]}>
                          {t('getIt')}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      <View
        style={styles.list}
      >
        {loading && <ActivityIndicator color={colors.primary} style={{ paddingVertical: spacing.lg }} />}

        {!loading && dataError && (
          <View style={styles.emptyWrap}>
            <Text style={[typography.body, { color: colors.brownMuted, marginTop: spacing.md, textAlign: 'center', fontFamily: `${font}Regular` }]}>
              {t('errorGeneric')}
            </Text>
          </View>
        )}

        {!loading && !dataError && sortedItems.length === 0 && (
          <View style={styles.emptyWrap}>
            <Search size={36} color={colors.brownMuted} />
            <Text style={[typography.body, { color: colors.brownMuted, marginTop: spacing.md, fontFamily: `${font}Regular` }]}>
              {search || filter !== 'all' ? t('noResults') : t('noOpenRequests')}
            </Text>
          </View>
        )}

        {sortedItems.map((item) => {
          const isRequest = item.type === 'request';
          const req = item.data as MealRequest;
          const don = item.data as FoodDonation;
          const isSelected = selected?.id === (isRequest ? req.id : don.id);
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.listCard, isSelected && { borderColor: colors.primary, borderWidth: 2 }]}
              onPress={() => showBottomCard({ type: item.type, id: isRequest ? req.id : don.id } as SelectedItem)}
              activeOpacity={0.7}
            >
              <View style={[styles.listIcon, { backgroundColor: isRequest ? colors.errorBg : colors.greenBg }]}>
                {isRequest ? <Heart size={20} color={colors.coral} /> : <UtensilsCrossed size={20} color={colors.green} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]} numberOfLines={1}>
                  {isRequest ? `${req.meals} ${t('meals')}` : don.food_name}
                </Text>
                {isRequest ? (
                  <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]} numberOfLines={1}>
                    {`${req.timing === 'now' ? t('now') : t('later')} · ${timeAgo(req.created_at, language)}`}
                  </Text>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]} numberOfLines={1}>
                      {`${don.meals} ${t('meals')} · `}
                    </Text>
                    <LiveCountdown
                      iso={don.expires_at}
                      lang={language}
                      style={[typography.small, { color: colors.warning, fontFamily: `${font}SemiBold` }]}
                    />
                  </View>
                )}
              </View>
              {item.dist !== null && (
                <View style={styles.distBadge}>
                  <Navigation size={11} color={colors.greenDark} />
                  <Text style={[typography.micro, { color: colors.greenDark, fontFamily: `${font}SemiBold` }]}>
                    {distText(item.dist)}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      </ScrollView>

      {selected && (selectedRequest || selectedDonation) && (
        <Animated.View
          style={[
            styles.bottomCard,
            {
              paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.lg,
              transform: [{
                translateY: bottomAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [300, 0],
                }),
              }],
            },
          ]}
        >
          <View style={styles.bottomHandle} />
          <TouchableOpacity style={styles.closeBtn} onPress={hideBottomCard} activeOpacity={0.7}>
            <X size={20} color={colors.brownMuted} />
          </TouchableOpacity>

          {actionResult ? (
            <View style={styles.resultWrap}>
              <CheckCircle2 size={48} color={colors.green} />
              <Text style={[typography.heading, { color: colors.greenDark, marginTop: spacing.sm, fontFamily: `${font}Bold` }]}>
                {actionResult}
              </Text>
              {claimedDonation && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.primary, marginTop: spacing.md }]}
                  onPress={() => {
                    hideBottomCard();
                    router.push({ pathname: '/chat', params: { donationId: claimedDonation.id, otherUserId: claimedDonation.user_id } });
                  }}
                  activeOpacity={0.8}
                >
                  <MessageCircle size={20} color={colors.white} />
                  <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>
                    {t('chatNow')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : selectedRequest ? (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 220 }}>
              <View style={styles.detailHeader}>
                <View style={[styles.detailIcon, { backgroundColor: colors.errorBg }]}>
                  <Heart size={24} color={colors.coral} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.heading, { color: colors.brown, fontFamily: `${font}Bold` }]}>
                    {selectedRequest.meals} {t('meals')}
                  </Text>
                  <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                    {t('markerRequest')}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <View style={styles.detailCell}>
                  <Clock size={14} color={colors.brownMuted} />
                  <Text style={[typography.small, { color: colors.brown, fontFamily: `${font}SemiBold` }]}>
                    {selectedRequest.timing === 'now' ? t('now') : t('later')}
                  </Text>
                </View>
                <View style={styles.detailCell}>
                  <MapPin size={14} color={colors.brownMuted} />
                  <Text style={[typography.small, { color: colors.greenDark, fontFamily: `${font}SemiBold` }]}>
                    {distText(location ? haversineKm(location, { latitude: selectedRequest.latitude, longitude: selectedRequest.longitude }) : null)}
                  </Text>
                </View>
              </View>

              <Text style={[typography.caption, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                {timeAgo(selectedRequest.created_at, language)}
              </Text>

              <TouchableOpacity
                style={styles.sendOfferBtn}
                onPress={() => acceptRequest(selectedRequest)}
                disabled={actionBusy}
                activeOpacity={0.8}
              >
                {actionBusy ? <ActivityIndicator color={colors.white} size={18} /> : (
                  <>
                    <HandHeart size={22} color={colors.white} />
                    <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold`, fontSize: 17 }]}>
                      {t('sendOffer')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          ) : selectedDonation && (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 220 }}>
              <View style={styles.detailHeader}>
                <View style={[styles.detailIcon, { backgroundColor: colors.greenBg }]}>
                  <UtensilsCrossed size={24} color={colors.green} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.heading, { color: colors.brown, fontFamily: `${font}Bold` }]} numberOfLines={1}>
                    {selectedDonation.food_name}
                  </Text>
                  <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                    {t('markerFood')}
                  </Text>
                </View>
              </View>

              {selectedDonation.description ? (
                <Text style={[typography.caption, { color: colors.brown, marginBottom: spacing.sm, fontFamily: `${font}Regular` }]}>
                  {selectedDonation.description}
                </Text>
              ) : null}

              <View style={styles.detailRow}>
                <View style={styles.detailCell}>
                  <UtensilsCrossed size={14} color={colors.brownMuted} />
                  <Text style={[typography.small, { color: colors.brown, fontFamily: `${font}SemiBold` }]}>
                    {selectedDonation.meals} {t('meals')}
                  </Text>
                </View>
                <View style={styles.detailCell}>
                  <MapPin size={14} color={colors.brownMuted} />
                  <Text style={[typography.small, { color: colors.greenDark, fontFamily: `${font}SemiBold` }]}>
                    {distText(location ? haversineKm(location, { latitude: selectedDonation.latitude, longitude: selectedDonation.longitude }) : null)}
                  </Text>
                </View>
                <View style={styles.detailCell}>
                  <Clock size={14} color={colors.warning} />
                  <LiveCountdown
                    iso={selectedDonation.expires_at}
                    lang={language}
                    style={[typography.small, { color: colors.warning, fontFamily: `${font}SemiBold` }]}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.green }]}
                onPress={() => claimFood(selectedDonation)}
                disabled={actionBusy}
                activeOpacity={0.8}
              >
                {actionBusy ? <ActivityIndicator color={colors.white} size={18} /> : (
                  <>
                    <CheckCircle2 size={20} color={colors.white} />
                    <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>
                      {actionBusy ? t('booking') : t('bookFood')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xs,
  },
  refreshBtn: { padding: spacing.sm },
  headerSpacer: { width: 36 },
  logoCenter: { alignItems: 'center', justifyContent: 'center' },
  logo: { width: 84, height: 84 },
  quickActions: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  quickAction: { flex: 1, minHeight: 54, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, shadowColor: colors.shadowStrong, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  requestAction: { backgroundColor: colors.coral },
  shareAction: { backgroundColor: colors.primary },
  quickActionText: { color: colors.white, fontSize: 13, textAlign: 'center' },
  searchRow: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surfaceAlt, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: Platform.OS === 'ios' ? 12 : 10,
  },
  searchInput: { ...typography.body, flex: 1, color: colors.brown, padding: 0 },
  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.pill,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderWidth: 1.5, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.small, color: colors.brown },
  chipTextActive: { color: colors.white },
  mapWrap: {
    height: MAP_HEIGHT,
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  map: { flex: 1 },
  mapLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surfaceAlt },
  locatingOverlay: {
    position: 'absolute', top: spacing.sm, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.white, alignSelf: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.pill, marginHorizontal: spacing.xxl,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3,
  },
  legend: {
    position: 'absolute', bottom: spacing.sm, left: spacing.sm, right: spacing.sm,
    flexDirection: 'row', justifyContent: 'center', gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: radius.pill, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { ...typography.micro, color: colors.brown },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  emptyWrap: { alignItems: 'center', paddingVertical: spacing.xxl },
  listCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1.5, borderColor: colors.border,
  },
  listIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  distBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: colors.greenBg, borderRadius: radius.pill,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  bottomCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl,
    shadowColor: colors.shadowStrong, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 1, shadowRadius: 16, elevation: 10,
    maxHeight: 360,
  },
  bottomHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.sm },
  closeBtn: { position: 'absolute', top: spacing.sm, right: spacing.md, padding: spacing.xs },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  detailIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  detailRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.sm },
  detailCell: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.coral, borderRadius: radius.md, paddingVertical: spacing.md,
    marginTop: spacing.sm,
    shadowColor: colors.coral, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  sendOfferBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.coral, borderRadius: radius.lg, paddingVertical: spacing.md + 4,
    marginTop: spacing.md,
    shadowColor: colors.coral, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 6,
  },
  resultWrap: { alignItems: 'center', paddingVertical: spacing.lg },
  suggestedSection: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  suggestedEmpty: { alignItems: 'center', paddingVertical: spacing.md },
  suggestedCard: {
    width: 168, backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden',
    marginRight: spacing.sm, borderWidth: 1.5, borderColor: colors.border,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  suggestedImage: { width: '100%', height: 96 },
  suggestedImagePlaceholder: { backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  suggestedBody: { padding: spacing.sm },
  suggestedMeta: { flexDirection: 'row', gap: spacing.xs, marginVertical: 6, flexWrap: 'wrap' },
  suggestedDistBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: colors.greenBg, borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 2,
  },
  suggestedExpiryBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: colors.warningBg, borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 2,
  },
  getItBtn: {
    backgroundColor: colors.green, borderRadius: radius.md, paddingVertical: spacing.xs,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
});

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { LocateFixed } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/lib/theme';
import { Coords } from '@/lib/location';
import { FoodDonation, MealRequest } from '@/lib/supabase';

type Props = {
  location: Coords | null;
  locating: boolean;
  requests: MealRequest[];
  donations: FoodDonation[];
  font: string;
  t: (key: string) => string;
  onSelect: (item: { type: 'request' | 'food'; id: string }) => void;
  onReady: () => void;
};

export function SharekMap({ location, locating, requests, donations, font, t, onSelect, onReady }: Props) {
  const mapRef = useRef<MapView>(null);
  const [centered, setCentered] = useState(false);

  useEffect(() => {
    if (!location || centered) return;
    mapRef.current?.animateToRegion({
      latitude: location.latitude,
      longitude: location.longitude,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    }, 800);
    setCentered(true);
  }, [centered, location]);

  const centerOnUser = useCallback(() => {
    if (!location) return;
    mapRef.current?.animateToRegion({
      latitude: location.latitude,
      longitude: location.longitude,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    }, 650);
  }, [location]);

  const zoomMap = useCallback(async (direction: 'in' | 'out') => {
    const camera = await mapRef.current?.getCamera();
    if (!camera) return;
    const currentZoom = camera.zoom ?? 14;
    mapRef.current?.animateCamera({ ...camera, zoom: direction === 'in' ? currentZoom + 1 : currentZoom - 1 }, { duration: 250 });
  }, []);

  return (
    <View style={styles.mapWrap}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        mapType="standard"
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass
        showsScale
        rotateEnabled
        scrollEnabled
        zoomEnabled
        pitchEnabled
        toolbarEnabled={false}
        loadingEnabled
        loadingIndicatorColor={colors.primary}
        loadingBackgroundColor={colors.background}
        initialRegion={{
          latitude: location?.latitude ?? 24.4539,
          longitude: location?.longitude ?? 54.3773,
          latitudeDelta: location ? 0.012 : 5,
          longitudeDelta: location ? 0.012 : 5,
        }}
        onMapReady={onReady}
      >
        {location && (
          <Circle
            center={{ latitude: location.latitude, longitude: location.longitude }}
            radius={Math.max(location.accuracy ?? 35, 25)}
            strokeColor="rgba(30, 136, 229, 0.45)"
            fillColor="rgba(30, 136, 229, 0.16)"
            zIndex={1}
          />
        )}
        {requests.map((request) => (
          <Marker
            key={`request-${request.id}`}
            coordinate={{ latitude: request.latitude, longitude: request.longitude }}
            title={t('markerRequest')}
            description={`${request.meals} ${t('meals')}`}
            onPress={() => onSelect({ type: 'request', id: request.id })}
            zIndex={3}
          >
            <View style={[styles.realMapMarker, styles.requestMarker]}><Text style={styles.markerEmoji}>❤️</Text></View>
          </Marker>
        ))}
        {donations.map((donation) => (
          <Marker
            key={`food-${donation.id}`}
            coordinate={{ latitude: donation.latitude, longitude: donation.longitude }}
            title={donation.food_name}
            description={`${donation.meals} ${t('meals')}`}
            onPress={() => onSelect({ type: 'food', id: donation.id })}
            zIndex={2}
          >
            <View style={[styles.realMapMarker, styles.foodMarker]}><Text style={styles.markerEmoji}>🍱</Text></View>
          </Marker>
        ))}
      </MapView>
      {locating && <LoadingOverlay font={font} t={t} />}
      <View style={styles.mapControls}>
        <TouchableOpacity style={styles.mapControlBtn} onPress={centerOnUser} activeOpacity={0.75}><LocateFixed size={18} color={colors.primary} /></TouchableOpacity>
        <TouchableOpacity style={styles.mapControlBtn} onPress={() => zoomMap('in')} activeOpacity={0.75}><Text style={[styles.mapControlText, { fontFamily: `${font}Bold` }]}>+</Text></TouchableOpacity>
        <TouchableOpacity style={styles.mapControlBtn} onPress={() => zoomMap('out')} activeOpacity={0.75}><Text style={[styles.mapControlText, { fontFamily: `${font}Bold` }]}>−</Text></TouchableOpacity>
      </View>
      <Legend font={font} t={t} />
    </View>
  );
}

function LoadingOverlay({ font, t }: { font: string; t: (key: string) => string }) {
  return <View style={styles.locatingOverlay}><ActivityIndicator color={colors.primary} size="small" /><Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>{t('locating')}</Text></View>;
}

function Legend({ font, t }: { font: string; t: (key: string) => string }) {
  return (
    <View style={styles.legend}>
      <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.coral }]} /><Text style={[styles.legendText, { fontFamily: `${font}SemiBold` }]}>{t('markerRequest')}</Text></View>
      <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.green }]} /><Text style={[styles.legendText, { fontFamily: `${font}SemiBold` }]}>{t('markerFood')}</Text></View>
      <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#1E88E5', borderColor: colors.white, borderWidth: 2 }]} /><Text style={[styles.legendText, { fontFamily: `${font}SemiBold` }]}>{t('myLocation')}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: { height: 320, marginHorizontal: spacing.lg, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.border },
  map: { flex: 1 },
  realMapMarker: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white, shadowColor: colors.shadowStrong, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 6 },
  requestMarker: { backgroundColor: colors.coral },
  foodMarker: { backgroundColor: colors.green },
  markerEmoji: { fontSize: 18 },
  mapControls: { position: 'absolute', right: spacing.sm, top: spacing.sm, gap: spacing.xs },
  mapControlBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 4 },
  mapControlText: { fontSize: 24, lineHeight: 26, color: colors.primary },
  locatingOverlay: { position: 'absolute', top: spacing.sm, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.white, alignSelf: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, marginHorizontal: spacing.xxl, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  legend: { position: 'absolute', bottom: spacing.sm, left: spacing.sm, right: spacing.sm, flexDirection: 'row', justifyContent: 'center', gap: spacing.md, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: radius.pill, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { ...typography.micro, color: colors.brown },
});

import * as Location from 'expo-location';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Coords {
  latitude: number;
  longitude: number;
}

export async function ensureLocationPermission(): Promise<boolean> {
  if ((await AsyncStorage.getItem('sharek_location_enabled')) === 'false') return false;
  if (Platform.OS === 'web') return true;
  const { status: existing } = await Location.getForegroundPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function getCurrentLocation(): Promise<Coords | null> {
  try {
    if ((await AsyncStorage.getItem('sharek_location_enabled')) === 'false') return null;
    if (Platform.OS === 'web') {
      return new Promise((resolve) => {
        if (!navigator?.geolocation) {
          resolve(null);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return null;
  }
}

export async function watchLocation(onChange: (coords: Coords) => void): Promise<() => void> {
  if ((await AsyncStorage.getItem('sharek_location_enabled')) === 'false') return () => undefined;
  if (Platform.OS === 'web') {
    if (!navigator?.geolocation) return () => undefined;
    const id = navigator.geolocation.watchPosition(
      (pos) => onChange({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }
  const subscription = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
    (pos) => onChange({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
  );
  return () => subscription.remove();
}

export function haversineKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

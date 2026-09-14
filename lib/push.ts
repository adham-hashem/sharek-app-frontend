import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiPost } from './api';

type NotificationsModule = typeof import('expo-notifications');

function getNativeNotifications(): NotificationsModule | null {
  // expo-notifications does not support push-token listeners in web bundles.
  // Loading it only on native prevents the browser-only warning and no-op code.
  if (Platform.OS === 'web') return null;
  return require('expo-notifications') as NotificationsModule;
}

export async function registerPushDevice(): Promise<void> {
  const Notifications = getNativeNotifications();
  if (!Notifications) return;
  const permission = await Notifications.getPermissionsAsync();
  let status = permission.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  await apiPost('/v1/devices/push', { expo_push_token: token.data, platform: Platform.OS });
}

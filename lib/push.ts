import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiPost } from './api';

export async function registerPushDevice(): Promise<void> {
  if (Platform.OS === 'web') return;
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

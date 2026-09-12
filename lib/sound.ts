import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let soundObj: Audio.Sound | null = null;

const SOUND_FILES = {
  request: require('../assets/sounds/request.wav'),
  accepted: require('../assets/sounds/accepted.wav'),
  reservation: require('../assets/sounds/reservation.wav'),
  message: require('../assets/sounds/message.wav'),
  completed: require('../assets/sounds/completed.wav'),
};

export type SoundType = keyof typeof SOUND_FILES | 'default';

export async function playNotificationSound(type: SoundType = 'default') {
  if (Platform.OS === 'web') {
    // Basic web fallback or ignore
    return;
  }
  
  try {
    if (soundObj) {
      await soundObj.unloadAsync();
      soundObj = null;
    }
    
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    });
    
    if (type !== 'default' && SOUND_FILES[type]) {
      const { sound } = await Audio.Sound.createAsync(SOUND_FILES[type]);
      soundObj = sound;
      await soundObj.playAsync();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
  } catch (err) {
    console.warn('Error playing sound', err);
  }
}

export function vibrateDevice(heavy = false) {
  if (Platform.OS !== 'web') {
    if (heavy) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch {
      /* ignore */
    }
  }
}

export async function notifyIncomingRequest(title: string, body: string, soundType: SoundType = 'default') {
  try {
    if (Platform.OS === 'web') {
      if (typeof Notification !== 'undefined') {
        if (Notification.permission === 'default') await Notification.requestPermission();
        if (Notification.permission === 'granted') new Notification(title, { body });
      }
      return;
    }
    const current = await Notifications.getPermissionsAsync();
    const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
    if (permission.granted) {
      await Notifications.scheduleNotificationAsync({ 
        content: { title, body, sound: 'default' }, 
        trigger: null 
      });
      // Play custom sound locally
      playNotificationSound(soundType);
    }
  } catch {
    // Ignore
  }
}

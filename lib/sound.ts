import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';

type NotificationsModule = typeof import('expo-notifications');

const Notifications: NotificationsModule | null = Platform.OS === 'web'
  ? null
  : require('expo-notifications') as NotificationsModule;

// Browser notifications use the Web Notifications API below. Keeping the
// native module out of web startup also avoids its unsupported token listener.
Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let soundObj: AudioPlayer | null = null;

const SOUND_FILES = {
  request: require('../assets/sounds/request.wav'),
  accepted: require('../assets/sounds/accepted.wav'),
  reservation: require('../assets/sounds/reservation.wav'),
  message: require('../assets/sounds/message.wav'),
  completed: require('../assets/sounds/completed.wav'),
};

export type SoundType = keyof typeof SOUND_FILES | 'default';

export async function playInteractionSound() {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextCtor) {
        const context = new AudioContextCtor();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = 660;
        gain.gain.setValueAtTime(0.035, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.08);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.08);
        setTimeout(() => { void context.close(); }, 150);
      }
      return;
    }
    await Haptics.selectionAsync();
  } catch {
    // Feedback must never block the action.
  }
}

export async function playNotificationSound(type: SoundType = 'default') {
  if (Platform.OS === 'web') {
    // Basic web fallback or ignore
    return;
  }
  
  try {
    if (soundObj) {
      soundObj.release();
      soundObj = null;
    }
    
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
    });
    
    if (type !== 'default' && SOUND_FILES[type]) {
      soundObj = createAudioPlayer(SOUND_FILES[type]);
      soundObj.play();
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
    if (!Notifications) return;
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

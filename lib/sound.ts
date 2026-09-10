import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (Platform.OS !== 'web') return null;
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

export function playNotificationSound() {
  if (Platform.OS !== 'web') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    return;
  }
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();

  const now = ctx.currentTime;

  const playTone = (freq: number, start: number, duration: number, gainVal: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + start);
    gain.gain.linearRampToValueAtTime(gainVal, now + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + start);
    osc.stop(now + start + duration);
  };

  playTone(880, 0, 0.15, 0.3);
  playTone(1320, 0.12, 0.2, 0.25);
}

export function vibrateDevice() {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
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

export async function notifyIncomingRequest(title: string, body: string) {
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
    if (permission.granted) await Notifications.scheduleNotificationAsync({ content: { title, body, sound: 'default' }, trigger: null });
  } catch {
    // Notification permissions are optional; the realtime in-app card remains available.
  }
}

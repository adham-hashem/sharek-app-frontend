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
let interactionSoundObj: AudioPlayer | null = null;
let timerTickSoundObj: AudioPlayer | null = null;
let transitionSoundObj: AudioPlayer | null = null;

const SOUND_FILES = {
  interaction: require('../assets/sounds/interaction.mp3'),
  request: require('../assets/sounds/request.wav'),
  accepted: require('../assets/sounds/accepted.wav'),
  reservation: require('../assets/sounds/reservation.wav'),
  message: require('../assets/sounds/message.wav'),
  completed: require('../assets/sounds/completed.wav'),
  important: require('../assets/sounds/important-action.mp3'),
  timerTick: require('../assets/sounds/izafi-old_clock_tick_metallic-445181.mp3'),
  acceptedBonus: require('../assets/sounds/universfield-video-game-bonus-323603.mp3'),
  error: require('../assets/sounds/universfield-error-notification-129258.mp3'),
};

export type SoundType = keyof typeof SOUND_FILES | 'default';

export async function playInteractionSound() {
  try {
    if (!interactionSoundObj) {
      interactionSoundObj = createAudioPlayer(SOUND_FILES.interaction);
      interactionSoundObj.volume = 0.55;
    } else {
      await interactionSoundObj.seekTo(0);
    }
    interactionSoundObj.play();
    if (Platform.OS !== 'web') await Haptics.selectionAsync();
  } catch {
    // Feedback must never block the action.
  }
}

export async function playTimerTick() {
  try {
    if (!timerTickSoundObj) {
      timerTickSoundObj = createAudioPlayer(SOUND_FILES.timerTick);
      timerTickSoundObj.volume = 0.2;
    } else {
      await timerTickSoundObj.seekTo(0);
    }
    timerTickSoundObj.play();
  } catch {
    // Timer audio is optional feedback and must never interrupt matching.
  }
}

export async function playNotificationSound(type: SoundType = 'default') {
  try {
    if (type === 'accepted' || type === 'error') {
      if (timerTickSoundObj) {
        timerTickSoundObj.pause();
        await timerTickSoundObj.seekTo(0);
      }
      transitionSoundObj?.release();
      transitionSoundObj = createAudioPlayer(type === 'accepted' ? SOUND_FILES.acceptedBonus : SOUND_FILES.error);
      transitionSoundObj.volume = 0.8;
      transitionSoundObj.play();
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(type === 'accepted' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
      }
      return;
    }
    if (soundObj) {
      soundObj.release();
      soundObj = null;
    }
    
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
    });
    
    if (type !== 'default' && SOUND_FILES[type]) {
      const source = type === 'completed' ? SOUND_FILES.important : SOUND_FILES[type];
      soundObj = createAudioPlayer(source);
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

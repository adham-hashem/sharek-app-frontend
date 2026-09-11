import { supabase, NotificationType, Notification, AppLanguage, UserSettings } from './supabase';
import { playNotificationSound, vibrateDevice } from './sound';
import { Platform } from 'react-native';

export interface NotificationMeta {
  icon: string;
  color: string;
  bgColor: string;
}

const IMPORTANT_TYPES: NotificationType[] = [
  'food_claimed', 'new_offer', 'offer_accepted', 'offer_declined',
  'food_received', 'match_completed', 'new_chat_message', 'rating_reminder',
];

const NOTIFICATION_META: Record<NotificationType, NotificationMeta> = {
  food_claimed: { icon: 'UtensilsCrossed', color: '#2E9E5B', bgColor: '#E8F5EC' },
  food_ready: { icon: 'Package', color: '#E09A1A', bgColor: '#FFF6E0' },
  food_received: { icon: 'CheckCircle2', color: '#2E9E5B', bgColor: '#E8F5EC' },
  food_completed: { icon: 'CheckCircle2', color: '#1F7A45', bgColor: '#E8F5EC' },
  new_offer: { icon: 'HandHeart', color: '#FF6B35', bgColor: '#FFF0E8' },
  offer_accepted: { icon: 'Heart', color: '#F7564C', bgColor: '#FDECEC' },
  offer_declined: { icon: 'XCircle', color: '#B0B0B0', bgColor: '#F0F0F0' },
  offer_expired: { icon: 'Clock', color: '#B0B0B0', bgColor: '#F0F0F0' },
  match_completed: { icon: 'CheckCircle2', color: '#1F7A45', bgColor: '#E8F5EC' },
  match_cancelled: { icon: 'XCircle', color: '#B0B0B0', bgColor: '#F0F0F0' },
  new_chat_message: { icon: 'MessageCircle', color: '#2E6FB0', bgColor: '#E8F0FA' },
  location_updated: { icon: 'Navigation', color: '#2E9E5B', bgColor: '#E8F5EC' },
  pickup_status_update: { icon: 'Package', color: '#E09A1A', bgColor: '#FFF6E0' },
  new_nearby_meal: { icon: 'UtensilsCrossed', color: '#2E9E5B', bgColor: '#E8F5EC' },
  new_meal_request: { icon: 'Heart', color: '#F7564C', bgColor: '#FDECEC' },
  rating_reminder: { icon: 'Star', color: '#D4A017', bgColor: '#FFF8DC' },
};

export function getNotificationMeta(type: NotificationType): NotificationMeta {
  return NOTIFICATION_META[type] ?? NOTIFICATION_META.new_chat_message;
}

export const NOTIFICATION_TITLES: Record<NotificationType, { ar: string; en: string }> = {
  food_claimed: { ar: 'تم طلب الوجبة', en: 'Meal Claimed' },
  food_ready: { ar: 'الوجبة جاهزة للاستلام', en: 'Meal Ready for Pickup' },
  food_received: { ar: 'تم استلام الوجبة', en: 'Meal Received' },
  food_completed: { ar: 'اكتمل التوصيل', en: 'Delivery Completed' },
  new_offer: { ar: 'عرض جديد', en: 'New Offer' },
  offer_accepted: { ar: 'تم قبول عرضك', en: 'Your Offer Accepted' },
  offer_declined: { ar: 'تم رفض عرضك', en: 'Offer Declined' },
  offer_expired: { ar: 'انتهت صلاحية العرض', en: 'Offer Expired' },
  match_completed: { ar: 'اكتمل التطابق', en: 'Match Completed' },
  match_cancelled: { ar: 'تم إلغاء التطابق', en: 'Match Cancelled' },
  new_chat_message: { ar: 'رسالة جديدة', en: 'New Message' },
  location_updated: { ar: 'تحديث الموقع', en: 'Location Updated' },
  pickup_status_update: { ar: 'تحديث حالة الاستلام', en: 'Pickup Status Updated' },
  new_nearby_meal: { ar: 'وجبة جديدة قريبة', en: 'New Meal Nearby' },
  new_meal_request: { ar: 'طلب وجبة جديد', en: 'New Meal Request' },
  rating_reminder: { ar: 'تذكير التقييم', en: 'Rating Reminder' },
};

export function getNotificationTitle(type: NotificationType, lang: AppLanguage): string {
  const entry = NOTIFICATION_TITLES[type];
  return entry ? entry[lang] : type;
}

export async function createNotification(
  userId: string,
  type: NotificationType,
  body: string,
  data?: Record<string, unknown>,
  lang: AppLanguage = 'ar',
): Promise<void> {
  const { data: settingsRow } = await supabase
    .from('user_settings')
    .select('notifications_enabled')
    .eq('user_id', userId)
    .maybeSingle();

  const settings = settingsRow as UserSettings | null;
  if (settings && !settings.notifications_enabled) return;

  const title = getNotificationTitle(type, lang);
  await supabase.rpc('create_notification', {
    p_user_id: userId,
    p_type: type,
    p_title: title,
    p_body: body,
    p_data: data ? JSON.stringify(data) : null,
  });
}

export function playNotificationFeedback(
  type: NotificationType,
  settings: UserSettings | null,
): void {
  if (!settings) return;
  if (!settings.notifications_enabled) return;
  if (IMPORTANT_TYPES.includes(type) || true) {
    if (settings.request_sound_enabled) {
      playNotificationSound();
    }
    if (settings.vibration_enabled) {
      vibrateDevice();
    }
  }
}

export function getNotificationRoute(notif: Notification): string | null {
  const data = notif.data;
  if (!data) return null;
  const donationId = data.food_donation_id as string | undefined;
  const otherUserId = data.other_user_id as string | undefined;
  const matchId = data.match_id as string | undefined;
  const requestId = data.meal_request_id as string | undefined;

  if (donationId && otherUserId) {
    return `/chat?donationId=${donationId}&otherUserId=${otherUserId}`;
  }
  if (matchId && otherUserId) {
    return `/chat?matchId=${matchId}&otherUserId=${otherUserId}`;
  }
  if (requestId && otherUserId) {
    return `/chat?matchId=${requestId}&otherUserId=${otherUserId}`;
  }
  return null;
}

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error || !data) return [];
  return data as Notification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
}

export async function markAllNotificationsRead(): Promise<void> {
  await supabase.rpc('mark_all_notifications_read');
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error || count === null) return 0;
  return count;
}

export function timeAgo(iso: string, lang: AppLanguage): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return lang === 'ar' ? 'الآن' : 'just now';
  if (mins < 60) return lang === 'ar' ? `قبل ${mins} دقيقة` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return lang === 'ar' ? `قبل ${hrs} ساعة` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return lang === 'ar' ? `قبل ${days} يوم` : `${days}d ago`;
}

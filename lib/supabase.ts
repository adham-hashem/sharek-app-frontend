import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: {
      getItem: AsyncStorage.getItem,
      setItem: AsyncStorage.setItem,
      removeItem: AsyncStorage.removeItem,
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

export type UserRole = 'needer' | 'donor' | 'charity' | 'organization' | 'restaurant' | 'hotel' | 'skipped';
export type UserMode = 'needer' | 'donor';
export type AppLanguage = 'ar' | 'en';
export type UserReligion = 'muslim' | 'christian' | 'jewish' | 'other';
export type MealRequestStatus = 'open' | 'matched' | 'fulfilled' | 'cancelled' | 'expired';
export type FoodDonationStatus = 'available' | 'claimed' | 'ready_for_pickup' | 'received' | 'completed' | 'expired' | 'rated';
export type MatchStatus = 'accepted' | 'completed' | 'cancelled';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  mode: UserMode | null;
  language: AppLanguage;
  phone: string;
  country: string;
  currency: string;
  avatar_url: string | null;
  rating: number;
  meals_helped: number;
  meals_received: number;
  contributor_level: number;
  is_verified: boolean;
  verified_at: string | null;
  is_admin: boolean;
  religion: UserReligion | null;
  created_at: string;
  updated_at: string;
}

export interface ContributorLevel {
  level: number;
  emoji: string;
  labelKey: string;
  minContributions: number;
  maxContributions: number;
  color: string;
  bgColor: string;
}

export const CONTRIBUTOR_LEVELS: ContributorLevel[] = [
  { level: 0, emoji: '🌱', labelKey: 'levelNew', minContributions: 0, maxContributions: 4, color: '#2E9E5B', bgColor: '#E8F5EC' },
  { level: 1, emoji: '🚀', labelKey: 'levelRising', minContributions: 5, maxContributions: 14, color: '#FF6B35', bgColor: '#FFF0E8' },
  { level: 2, emoji: '❤️', labelKey: 'levelActive', minContributions: 15, maxContributions: 29, color: '#F7564C', bgColor: '#FDECEC' },
  { level: 3, emoji: '⭐', labelKey: 'levelDistinguished', minContributions: 30, maxContributions: 59, color: '#E09A1A', bgColor: '#FFF6E0' },
  { level: 4, emoji: '🏆', labelKey: 'levelGolden', minContributions: 60, maxContributions: 99, color: '#D4A017', bgColor: '#FFF8DC' },
  { level: 5, emoji: '👑', labelKey: 'levelAmbassador', minContributions: 100, maxContributions: 999999, color: '#3B2A20', bgColor: '#F5EDE3' },
];

export function getContributorLevel(level: number): ContributorLevel {
  return CONTRIBUTOR_LEVELS.find(l => l.level === level) ?? CONTRIBUTOR_LEVELS[0];
}

export function getNextContributorLevel(level: number): ContributorLevel | null {
  if (level >= 5) return null;
  return CONTRIBUTOR_LEVELS.find(l => l.level === level + 1) ?? null;
}

export interface UserSettings {
  user_id: string;
  notifications_enabled: boolean;
  request_sound_enabled: boolean;
  vibration_enabled: boolean;
  location_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppDonation {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  created_at: string;
  meal_price: number | null;
  meal_count: number | null;
  donation_type: 'general' | 'meals';
  meal_type_id?: string | null;
  meal_price_usd?: number | null;
  exchange_rate?: number | null;
  local_amount?: number | null;
  target_type?: 'general' | 'request' | 'charity' | null;
  target_request_id?: string | null;
  target_charity_id?: string | null;
  payment_status?: 'pending' | 'paid' | 'failed' | 'recorded';
  payment_method?: 'card' | 'wallet' | null;
}

export interface MealRequest {
  id: string;
  user_id: string;
  meals: number;
  timing: 'now' | 'later';
  status: MealRequestStatus;
  latitude: number;
  longitude: number;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface FoodDonation {
  id: string;
  user_id: string;
  food_name: string;
  description: string;
  image_url: string | null;
  image_urls?: string[] | null;
  meals: number;
  pickup_start: string;
  pickup_end: string;
  expires_at: string;
  status: FoodDonationStatus;
  latitude: number;
  longitude: number;
  claimer_lat: number | null;
  claimer_lng: number | null;
  claimer_location_updated_at: string | null;
  donor_lat: number | null;
  donor_lng: number | null;
  donor_location_updated_at: string | null;
  created_at: string;
  updated_at: string;
  food_type?: string | null;
  prepared_at?: string | null;
  storage_method?: string | null;
  allergens?: string | null;
}

export interface Match {
  id: string;
  request_id: string;
  helper_id: string;
  status: MatchStatus;
  delivery_status: 'accepted' | 'awaiting_pickup' | 'delivered';
  helper_lat: number | null;
  helper_lng: number | null;
  helper_location_updated_at: string | null;
  requester_lat: number | null;
  requester_lng: number | null;
  requester_location_updated_at: string | null;
  created_at: string;
}

export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export interface Offer {
  id: string;
  request_id: string;
  helper_id: string;
  status: OfferStatus;
  offered_meals: number;
  latitude: number;
  longitude: number;
  created_at: string;
  updated_at: string;
  response_expires_at?: string;
}

export type FoodClaimStatus = 'booked' | 'ready_for_pickup' | 'received' | 'completed' | 'cancelled';

export interface FoodClaim {
  id: string;
  food_donation_id: string;
  claimer_id: string;
  status: FoodClaimStatus;
  created_at: string;
}

export interface Message {
  id: string;
  food_donation_id: string | null;
  meal_request_id: string | null;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export type NotificationType =
  | 'food_claimed' | 'food_ready' | 'food_received' | 'food_completed'
  | 'new_offer' | 'offer_accepted' | 'offer_declined' | 'offer_expired'
  | 'match_completed' | 'match_cancelled'
  | 'new_chat_message' | 'location_updated' | 'pickup_status_update'
  | 'new_nearby_meal' | 'new_meal_request' | 'rating_reminder';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

export type VerificationRequestStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'suspended';
export type VerificationPaymentStatus = 'unpaid' | 'paid' | 'failed';

export interface VerificationFee {
  id: string;
  country_code: string;
  currency: string;
  amount: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VerificationRequest {
  id: string;
  user_id: string;
  status: VerificationRequestStatus;
  fee_amount: number;
  fee_currency: string;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  transaction_ref: string;
  payment_status: VerificationPaymentStatus;
  admin_notes: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type SupportTxStatus = 'pending' | 'succeeded' | 'failed' | 'cancelled';

export interface SupportTransaction {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: SupportTxStatus;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  transaction_ref: string;
  created_at: string;
  updated_at: string;
}

export interface FoodRating {
  id: string;
  food_donation_id: string;
  match_id: string | null;
  rater_id: string;
  rated_user_id: string;
  rating: number;
  review: string;
  is_flagged: boolean;
  created_at: string;
}

export interface AchievementBadge {
  level: number;
  emoji: string;
  labelKey: string;
  minShares: number;
  color: string;
  bgColor: string;
}

export const ACHIEVEMENT_BADGES: AchievementBadge[] = [
  { level: 0, emoji: '🌱', labelKey: 'badgeNew', minShares: 0, color: '#2E9E5B', bgColor: '#E8F5EC' },
  { level: 1, emoji: '❤️', labelKey: 'badgeGoodSamaritan', minShares: 5, color: '#F7564C', bgColor: '#FDECEC' },
  { level: 2, emoji: '⭐', labelKey: 'badgeDistinguished', minShares: 15, color: '#E09A1A', bgColor: '#FFF6E0' },
  { level: 3, emoji: '🏆', labelKey: 'badgeChampion', minShares: 30, color: '#D4A017', bgColor: '#FFF8DC' },
  { level: 4, emoji: '👑', labelKey: 'badgeAmbassador', minShares: 60, color: '#3B2A20', bgColor: '#F5EDE3' },
  { level: 5, emoji: '👑', labelKey: 'badgeAmbassador', minShares: 100, color: '#3B2A20', bgColor: '#F5EDE3' },
];

export function getAchievementBadge(level: number): AchievementBadge {
  return ACHIEVEMENT_BADGES.find(b => b.level === level) ?? ACHIEVEMENT_BADGES[0];
}

export function getNextAchievementBadge(level: number): AchievementBadge | null {
  if (level >= 4) return null;
  return ACHIEVEMENT_BADGES.find(b => b.level === level + 1) ?? null;
}

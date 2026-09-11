const fs = require('fs');
let content = fs.readFileSync('../last_update/project/lib/supabase.ts', 'utf8');

content = content.replace(/export interface AppDonation \{[\s\S]*?\}/, `export interface AppDonation {
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
}`);

content = content.replace(/export interface FoodDonation \{[\s\S]*?\}/, `export interface FoodDonation {
  id: string;
  user_id: string;
  food_name: string;
  description: string;
  image_url: string | null;
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
}`);

content = content.replace(/export interface Match \{[\s\S]*?\}/, `export interface Match {
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
}`);

content = content.replace(/export interface Offer \{[\s\S]*?\}/, `export interface Offer {
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
}`);

fs.writeFileSync('lib/supabase.ts', content, 'utf8');
console.log('supabase.ts merged successfully');

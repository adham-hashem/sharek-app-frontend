import { FoodDonation } from './supabase';

export function getFoodImages(donation: Pick<FoodDonation, 'image_url' | 'image_urls'> | null | undefined): string[] {
  if (!donation) return [];
  const urls = [
    ...(Array.isArray(donation.image_urls) ? donation.image_urls : []),
    donation.image_url,
  ].filter((url): url is string => Boolean(url));
  return [...new Set(urls)];
}

export function getPrimaryFoodImage(donation: Pick<FoodDonation, 'image_url' | 'image_urls'> | null | undefined): string | null {
  return getFoodImages(donation)[0] ?? null;
}

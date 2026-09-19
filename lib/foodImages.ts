import { FoodDonation } from './supabase';
import { supabase } from './supabase';

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

export async function resolveFoodImages(donation: FoodDonation): Promise<FoodDonation> {
  const urls = getFoodImages(donation);
  const resolved = await Promise.all(urls.map(async (url) => {
    const marker = '/food-photos/';
    const markerIndex = url.indexOf(marker);
    if (markerIndex < 0) return url;
    const path = decodeURIComponent(url.slice(markerIndex + marker.length).split('?')[0]);
    const { data } = await supabase.storage.from('food-photos').createSignedUrl(path, 30 * 24 * 60 * 60);
    return data?.signedUrl ?? url;
  }));
  return { ...donation, image_url: resolved[0] ?? null, image_urls: resolved };
}

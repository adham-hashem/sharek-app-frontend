export interface SampleMeal {
  id: string;
  food_name: string;
  description: string;
  image_url: string;
  meals: number;
  expires_at: string;
  latitude: number;
  longitude: number;
  dietary: string;
  donor_name: string;
  donor_id: string;
  distance: number;
}

const NOW = Date.now();
const hoursFromNow = (h: number) => new Date(NOW + h * 3600_000).toISOString();
const minsFromNow = (m: number) => new Date(NOW + m * 60_000).toISOString();

export const SAMPLE_MEALS: SampleMeal[] = [
  {
    id: 'sample-1',
    food_name: 'Chicken Biryani',
    description: 'Fresh homemade chicken biryani with basmati rice, spices, and raita on the side. Prepared today for a large event.',
    image_url: 'https://images.pexels.com/photos/6646211/pexels-photo-6646211.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    meals: 8,
    expires_at: hoursFromNow(3.5),
    latitude: 24.7136 + 0.006,
    longitude: 46.6753 + 0.004,
    dietary: 'Halal · Contains dairy · Nuts-free',
    donor_name: 'Al-Noor Restaurant',
    donor_id: 'sample-donor-1',
    distance: 0.4,
  },
  {
    id: 'sample-2',
    food_name: 'Vegetable Soup & Bread',
    description: 'Warm vegetable soup with fresh baked bread. Perfect for a cold day. Made this morning.',
    image_url: 'https://images.pexels.com/photos/34326239/pexels-photo-34326239.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    meals: 5,
    expires_at: hoursFromNow(1.5),
    latitude: 24.7136 - 0.003,
    longitude: 46.6753 + 0.007,
    dietary: 'Vegetarian · Vegan · Gluten-free bread',
    donor_name: 'Sara Ahmed',
    donor_id: 'sample-donor-2',
    distance: 0.8,
  },
  {
    id: 'sample-3',
    food_name: 'Grilled Fish & Rice',
    description: 'Grilled fish fillet with steamed rice and vegetables. Healthy and nutritious meal.',
    image_url: 'https://images.pexels.com/photos/37261964/pexels-photo-37261964.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    meals: 3,
    expires_at: minsFromNow(45),
    latitude: 24.7136 + 0.010,
    longitude: 46.6753 - 0.005,
    dietary: 'Halal · Pescatarian · Gluten-free',
    donor_name: 'Hotel Marriott',
    donor_id: 'sample-donor-3',
    distance: 1.2,
  },
  {
    id: 'sample-4',
    food_name: 'Pasta with Tomato Sauce',
    description: 'Pasta with homemade tomato sauce and cheese. Large batch from a catering event.',
    image_url: 'https://images.pexels.com/photos/28866447/pexels-photo-28866447.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    meals: 12,
    expires_at: hoursFromNow(5),
    latitude: 24.7136 - 0.008,
    longitude: 46.6753 - 0.003,
    dietary: 'Vegetarian · Contains gluten · Contains dairy',
    donor_name: 'Catering Co.',
    donor_id: 'sample-donor-4',
    distance: 1.8,
  },
  {
    id: 'sample-5',
    food_name: 'Rice & Beef Plate',
    description: 'Rice with cooked beef pieces, potatoes, and green beans. Home-cooked meal.',
    image_url: 'https://images.pexels.com/photos/38343259/pexels-photo-38343259.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    meals: 6,
    expires_at: hoursFromNow(2),
    latitude: 24.7136 + 0.015,
    longitude: 46.6753 + 0.010,
    dietary: 'Halal · Contains gluten',
    donor_name: 'Mohammed Ali',
    donor_id: 'sample-donor-5',
    distance: 2.5,
  },
  {
    id: 'sample-6',
    food_name: 'Chicken & Vegetable Rice',
    description: 'Chicken with vegetable rice and mushrooms. Freshly prepared surplus from a hotel buffet.',
    image_url: 'https://images.pexels.com/photos/31960616/pexels-photo-31960616.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    meals: 4,
    expires_at: minsFromNow(20),
    latitude: 24.7136 - 0.012,
    longitude: 46.6753 + 0.002,
    dietary: 'Halal · Contains dairy',
    donor_name: 'Ritz Hotel',
    donor_id: 'sample-donor-6',
    distance: 3.2,
  },
];

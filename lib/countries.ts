export interface CountryInfo {
  code: string;
  nameAr: string;
  nameEn: string;
  currency: string;
  currencySymbolAr: string;
  currencySymbolEn: string;
  flag: string;
  defaultMealPrice: number;
}

export const COUNTRIES: CountryInfo[] = [
  { code: 'SA', nameAr: 'السعودية', nameEn: 'Saudi Arabia', currency: 'SAR', currencySymbolAr: 'ر.س', currencySymbolEn: 'SAR', flag: '🇸🇦', defaultMealPrice: 15 },
  { code: 'AE', nameAr: 'الإمارات', nameEn: 'United Arab Emirates', currency: 'AED', currencySymbolAr: 'د.إ', currencySymbolEn: 'AED', flag: '🇦🇪', defaultMealPrice: 20 },
  { code: 'EG', nameAr: 'مصر', nameEn: 'Egypt', currency: 'EGP', currencySymbolAr: 'ج.م', currencySymbolEn: 'EGP', flag: '🇪🇬', defaultMealPrice: 60 },
  { code: 'KW', nameAr: 'الكويت', nameEn: 'Kuwait', currency: 'KWD', currencySymbolAr: 'د.ك', currencySymbolEn: 'KWD', flag: '🇰🇼', defaultMealPrice: 2 },
  { code: 'QA', nameAr: 'قطر', nameEn: 'Qatar', currency: 'QAR', currencySymbolAr: 'ر.ق', currencySymbolEn: 'QAR', flag: '🇶🇦', defaultMealPrice: 15 },
  { code: 'BH', nameAr: 'البحرين', nameEn: 'Bahrain', currency: 'BHD', currencySymbolAr: 'د.ب', currencySymbolEn: 'BHD', flag: '🇧🇭', defaultMealPrice: 2 },
  { code: 'OM', nameAr: 'عمان', nameEn: 'Oman', currency: 'OMR', currencySymbolAr: 'ر.ع', currencySymbolEn: 'OMR', flag: '🇴🇲', defaultMealPrice: 2 },
  { code: 'JO', nameAr: 'الأردن', nameEn: 'Jordan', currency: 'JOD', currencySymbolAr: 'د.أ', currencySymbolEn: 'JOD', flag: '🇯🇴', defaultMealPrice: 3 },
  { code: 'IQ', nameAr: 'العراق', nameEn: 'Iraq', currency: 'IQD', currencySymbolAr: 'د.ع', currencySymbolEn: 'IQD', flag: '🇮🇶', defaultMealPrice: 5000 },
  { code: 'LB', nameAr: 'لبنان', nameEn: 'Lebanon', currency: 'LBP', currencySymbolAr: 'ل.ل', currencySymbolEn: 'LBP', flag: '🇱🇧', defaultMealPrice: 100000 },
  { code: 'SY', nameAr: 'سوريا', nameEn: 'Syria', currency: 'SYP', currencySymbolAr: 'ل.س', currencySymbolEn: 'SYP', flag: '🇸🇾', defaultMealPrice: 50000 },
  { code: 'YE', nameAr: 'اليمن', nameEn: 'Yemen', currency: 'YER', currencySymbolAr: 'ر.ي', currencySymbolEn: 'YER', flag: '🇾🇪', defaultMealPrice: 2000 },
  { code: 'PS', nameAr: 'فلسطين', nameEn: 'Palestine', currency: 'ILS', currencySymbolAr: '₪', currencySymbolEn: 'ILS', flag: '🇵🇸', defaultMealPrice: 25 },
  { code: 'SD', nameAr: 'السودان', nameEn: 'Sudan', currency: 'SDG', currencySymbolAr: 'ج.س', currencySymbolEn: 'SDG', flag: '🇸🇩', defaultMealPrice: 3000 },
  { code: 'LY', nameAr: 'ليبيا', nameEn: 'Libya', currency: 'LYD', currencySymbolAr: 'د.ل', currencySymbolEn: 'LYD', flag: '🇱🇾', defaultMealPrice: 15 },
  { code: 'TN', nameAr: 'تونس', nameEn: 'Tunisia', currency: 'TND', currencySymbolAr: 'د.ت', currencySymbolEn: 'TND', flag: '🇹🇳', defaultMealPrice: 8 },
  { code: 'DZ', nameAr: 'الجزائر', nameEn: 'Algeria', currency: 'DZD', currencySymbolAr: 'د.ج', currencySymbolEn: 'DZD', flag: '🇩🇿', defaultMealPrice: 400 },
  { code: 'MA', nameAr: 'المغرب', nameEn: 'Morocco', currency: 'MAD', currencySymbolAr: 'د.م', currencySymbolEn: 'MAD', flag: '🇲🇦', defaultMealPrice: 40 },
  { code: 'MR', nameAr: 'موريتانيا', nameEn: 'Mauritania', currency: 'MRU', currencySymbolAr: 'أ.م', currencySymbolEn: 'MRU', flag: '🇲🇷', defaultMealPrice: 300 },
  { code: 'SO', nameAr: 'الصومال', nameEn: 'Somalia', currency: 'SOS', currencySymbolAr: 'ش.س', currencySymbolEn: 'SOS', flag: '🇸🇴', defaultMealPrice: 15000 },
  { code: 'DJ', nameAr: 'جيبوتي', nameEn: 'Djibouti', currency: 'DJF', currencySymbolAr: 'ف.ج', currencySymbolEn: 'DJF', flag: '🇩🇯', defaultMealPrice: 2000 },
  { code: 'KM', nameAr: 'جزر القمر', nameEn: 'Comoros', currency: 'KMF', currencySymbolAr: 'ف.ق', currencySymbolEn: 'KMF', flag: '🇰🇲', defaultMealPrice: 3000 },
  { code: 'GB', nameAr: 'المملكة المتحدة', nameEn: 'United Kingdom', currency: 'GBP', currencySymbolAr: '£', currencySymbolEn: 'GBP', flag: '🇬🇧', defaultMealPrice: 5 },
  { code: 'US', nameAr: 'الولايات المتحدة', nameEn: 'United States', currency: 'USD', currencySymbolAr: '$', currencySymbolEn: 'USD', flag: '🇺🇸', defaultMealPrice: 5 },
  { code: 'CA', nameAr: 'كندا', nameEn: 'Canada', currency: 'CAD', currencySymbolAr: 'C$', currencySymbolEn: 'CAD', flag: '🇨🇦', defaultMealPrice: 7 },
  { code: 'AU', nameAr: 'أستراليا', nameEn: 'Australia', currency: 'AUD', currencySymbolAr: 'A$', currencySymbolEn: 'AUD', flag: '🇦🇺', defaultMealPrice: 8 },
];

const countryByCode = new Map<string, CountryInfo>(COUNTRIES.map(c => [c.code, c]));
const countryByCurrency = new Map<string, CountryInfo>(COUNTRIES.map(c => [c.currency, c]));

export function getCountryByCode(code: string): CountryInfo | undefined {
  return countryByCode.get(code);
}

export function getCountryByCurrency(currency: string): CountryInfo | undefined {
  return countryByCurrency.get(currency);
}

export function getCurrencySymbol(currency: string, lang: 'ar' | 'en'): string {
  const country = countryByCurrency.get(currency);
  if (country) return lang === 'ar' ? country.currencySymbolAr : country.currencySymbolEn;
  return currency;
}

export function getDefaultMealPrice(currency: string): number {
  const country = countryByCurrency.get(currency);
  return country?.defaultMealPrice ?? 15;
}

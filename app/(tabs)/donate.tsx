import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, ScrollView,
  TextInput, Image, Platform, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';
import {
  Camera, Minus, Plus, MapPin, CheckCircle2, X, Heart, HandHeart, Bell,
  UtensilsCrossed, DollarSign, Clock, Calendar, ChevronLeft, MessageCircle,
  Navigation, Star, Loader2, PackageCheck, Truck, PartyPopper, Building2,
} from 'lucide-react-native';
import { supabase, FoodDonation, MealRequest, FoodClaim, Match, Profile } from '@/lib/supabase';
import { playNotificationSound, vibrateDevice, notifyIncomingRequest } from '@/lib/sound';
import { apiFetch, apiPost, apiPatch } from '@/lib/api';
import { router } from 'expo-router';
import { ensureLocationPermission, getCurrentLocation, watchLocation, Coords, haversineKm } from '@/lib/location';
import { LiveMatchMap } from '@/components/LiveMatchMap';
import { getPrimaryFoodImage } from '@/lib/foodImages';

type MainTab = 'choose' | 'food' | 'money' | 'requests' | 'claimed';
type NearbyRequestMapItem = {
  item_type: 'request' | 'food'; item_id: string; user_id?: string; meals?: number;
  timing?: 'now' | 'later'; status?: 'open'; latitude?: number; longitude?: number;
  created_at?: string; updated_at?: string; expires_at?: string;
};

function imageExtFromMime(mime: string) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

function imageMimeFromUri(uri: string) {
  const cleanUri = uri.split('?')[0]?.toLowerCase() ?? '';
  if (cleanUri.endsWith('.png')) return 'image/png';
  if (cleanUri.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

async function buildFoodPhotoUpload(uri: string, userId: string) {
  let body: Blob | { uri: string; type: string; name: string };
  let mime = imageMimeFromUri(uri);

  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    mime = blob.type && ['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)
      ? blob.type
      : mime;
    body = blob;
  } else {
    body = { uri, type: mime, name: 'food-photo' };
  }

  const ext = imageExtFromMime(mime);
  const suffix = Math.random().toString(36).slice(2, 10);
  return {
    path: `${userId}/${Date.now()}-${suffix}.${ext}`,
    body,
    contentType: mime,
  };
}

function mapItemToRequest(item: NearbyRequestMapItem): MealRequest {
  const createdAt = item.created_at ?? new Date().toISOString();
  return {
    id: item.item_id, user_id: item.user_id ?? '', meals: item.meals ?? 1,
    timing: item.timing ?? 'now', status: 'open', latitude: item.latitude ?? 0,
    longitude: item.longitude ?? 0, created_at: createdAt,
    updated_at: item.updated_at ?? createdAt,
    expires_at: item.expires_at ?? new Date(new Date(createdAt).getTime() + 30 * 60 * 1000).toISOString(),
  };
}

export default function DonateScreen() {
  const { t, language, profile } = useAuth();
  const [mainTab, setMainTab] = useState<MainTab>('choose');
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';

  const isDonor = profile?.role === 'donor' || profile?.role === 'charity' || profile?.role === 'restaurant' || profile?.role === 'hotel';

  return (
    <View style={[styles.container, { flex: 1 }]}>
      {mainTab === 'choose' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: 120 }}>
          <View style={styles.headerCard}>
            <View style={[styles.headerIcon, { backgroundColor: colors.green }]}>
              <HandHeart size={28} color={colors.white} />
            </View>
            <Text style={[typography.heading, { color: colors.brown, fontFamily: `${font}Bold` }]}>
              {t('donate')}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.choiceCard}
            onPress={() => setMainTab('food')}
            activeOpacity={0.8}
          >
            <View style={[styles.choiceIcon, { backgroundColor: colors.greenBg }]}>
              <UtensilsCrossed size={26} color={colors.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]}>
                {t('shareFood')}
              </Text>
              <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                {t('donatingFood')}
              </Text>
            </View>
            <ChevronLeft size={22} color={colors.brownMuted} style={{ transform: [{ scaleX: -1 }] }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.choiceCard}
            onPress={() => setMainTab('money')}
            activeOpacity={0.8}
          >
            <View style={[styles.choiceIcon, { backgroundColor: colors.warningBg }]}>
              <DollarSign size={26} color={colors.goldenDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]}>
                {t('donateMoneyMeals')}
              </Text>
              <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                {t('donatingMoney')}
              </Text>
            </View>
            <ChevronLeft size={22} color={colors.brownMuted} style={{ transform: [{ scaleX: -1 }] }} />
          </TouchableOpacity>

          {isDonor && (
            <TouchableOpacity
              style={styles.choiceCard}
              onPress={() => setMainTab('requests')}
              activeOpacity={0.8}
            >
              <View style={[styles.choiceIcon, { backgroundColor: colors.errorBg }]}>
                <Bell size={26} color={colors.coral} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]}>
                  {t('openRequests')}
                </Text>
                <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                  {t('acceptRequest')}
                </Text>
              </View>
              <ChevronLeft size={22} color={colors.brownMuted} style={{ transform: [{ scaleX: -1 }] }} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.choiceCard}
            onPress={() => setMainTab('claimed')}
            activeOpacity={0.8}
          >
            <View style={[styles.choiceIcon, { backgroundColor: colors.surfaceMuted }]}>
              <MessageCircle size={26} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]}>
                {t('chatTitle')}
              </Text>
              <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                {t('chatWithDonor')}
              </Text>
            </View>
            <ChevronLeft size={22} color={colors.brownMuted} style={{ transform: [{ scaleX: -1 }] }} />
          </TouchableOpacity>
        </ScrollView>
      )}

      {mainTab === 'food' && <FoodForm onBack={() => setMainTab('choose')} />}
      {mainTab === 'money' && <MoneyForm onBack={() => setMainTab('choose')} />}
      {mainTab === 'requests' && <RequestsList onBack={() => setMainTab('choose')} />}
      {mainTab === 'claimed' && <ClaimedList onBack={() => setMainTab('choose')} />}
    </View>
  );
}

function BackBar({ onPress }: { onPress: () => void }) {
  const { rtl, t, language } = useAuth();
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';
  return (
    <TouchableOpacity style={styles.backBar} onPress={onPress} activeOpacity={0.8}>
      <ChevronLeft size={22} color={colors.brown} style={{ transform: [{ scaleX: rtl ? -1 : 1 }] }} />
      <Text style={[typography.small, { color: colors.brown, fontFamily: `${font}Bold` }]}>
        {t('back')}
      </Text>
    </TouchableOpacity>
  );
}

function FoodForm({ onBack }: { onBack: () => void }) {
  const { t, language, user } = useAuth();
  const [photos, setPhotos] = useState<string[]>([]);
  const [foodName, setFoodName] = useState('');
  const [description, setDescription] = useState('');
  const [allergens, setAllergens] = useState('');
  const [meals, setMeals] = useState(1);
  const [expiresAt, setExpiresAt] = useState(new Date(Date.now() + 3 * 3600000));
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);
  const [expiryHours, setExpiryHours] = useState(3);
  const [expiryMinutes, setExpiryMinutes] = useState(0);
  const [location, setLocation] = useState<Coords | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [published, setPublished] = useState(false);
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';

  useEffect(() => {
    (async () => {
      const ok = await ensureLocationPermission();
      if (ok) {
        const coords = await getCurrentLocation();
        if (coords) setLocation(coords);
      }
    })();
  }, []);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      const gal = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!gal.granted) return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotos(prev => [...prev, result.assets[0].uri].slice(0, 8));
    }
  };

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      allowsMultipleSelection: true,
      selectionLimit: 8,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPhotos(prev => [...prev, ...result.assets.map(asset => asset.uri)].slice(0, 8));
    }
  };

  const applyExpiryDuration = () => {
    const newExpiry = new Date(Date.now() + expiryHours * 3600000 + expiryMinutes * 60000);
    setExpiresAt(newExpiry);
    setShowExpiryPicker(false);
  };

  const fmtExpiry = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const publish = async () => {
    if (!foodName.trim()) return Alert.alert(t('foodNameRequired'));
    let publishLocation = location;
    if (!publishLocation) {
      const ok = await ensureLocationPermission();
      if (ok) {
        publishLocation = await getCurrentLocation();
        if (publishLocation) setLocation(publishLocation);
      }
    }
    if (!publishLocation) return Alert.alert(t('locationError'));
    if (expiresAt.getTime() <= Date.now()) return Alert.alert(t('setExpiry'));

    setSubmitting(true);

    const imageUrls: string[] = [];
    for (const photo of photos) {
      let upload: Awaited<ReturnType<typeof buildFoodPhotoUpload>>;
      try {
        upload = await buildFoodPhotoUpload(photo, user!.id);
      } catch {
        setSubmitting(false);
        Alert.alert(t('publishFoodFailed'), t('errorGeneric'));
        return;
      }
      const { error: upErr } = await supabase.storage.from('food-photos').upload(upload.path, upload.body as any, {
        contentType: upload.contentType,
        upsert: false,
      });
      if (upErr) {
        setSubmitting(false);
        Alert.alert(t('publishFoodFailed'), upErr.message || t('errorGeneric'));
        return;
      }
      const { data: signed } = await supabase.storage.from('food-photos').createSignedUrl(upload.path, 7 * 24 * 60 * 60);
      if (!signed?.signedUrl) {
        setSubmitting(false);
        Alert.alert(t('errorGeneric'));
        return;
      }
      imageUrls.push(signed.signedUrl);
    }

    const now = new Date();
    const payload = {
        food_name: foodName.trim(),
        description: description.trim(),
        image_url: imageUrls[0] ?? null,
        image_urls: imageUrls,
        meals,
        pickup_start: now.toISOString(),
        pickup_end: expiresAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        latitude: publishLocation.latitude,
        longitude: publishLocation.longitude,
        prepared_at: now.toISOString(),
        allergens: allergens.trim() || undefined,
    };

    try {
      await apiPost<FoodDonation>('/v1/food-donations', payload);
    } catch (error) {
      const { error: dbError } = await supabase
        .from('food_donations')
        .insert({ ...payload, user_id: user!.id, status: 'available' })
        .select()
        .single();

      if (dbError) {
        setSubmitting(false);
        Alert.alert(
          t('publishFoodFailed'),
          dbError.message || (error instanceof Error ? error.message : t('errorGeneric')),
        );
        return;
      }
    }
    setSubmitting(false);
    setPublished(true);
    setFoodName('');
    setDescription('');
    setAllergens('');
    setPhotos([]);
    setMeals(1);
    setExpiryHours(3);
    setExpiryMinutes(0);
    setExpiresAt(new Date(Date.now() + 3 * 3600000));
  };

  if (published) {
    return (
      <View style={styles.successCard}>
        <BackBar onPress={onBack} />
        <View style={[styles.statusIcon, { backgroundColor: colors.greenBg }]}>
          <CheckCircle2 size={48} color={colors.green} />
        </View>
        <Text style={[typography.title, { color: colors.greenDark, marginTop: spacing.md, fontFamily: `${font}Bold` }]}>
          {t('foodPublished')}
        </Text>
        <TouchableOpacity style={styles.okBtn} onPress={() => { setPublished(false); onBack(); }}>
          <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>{t('confirm')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 140 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <BackBar onPress={onBack} />

      <Text style={[typography.bodyBold, { color: colors.brown, marginBottom: spacing.sm, fontFamily: `${font}Bold` }]}>
        {t('uploadPhoto')}
      </Text>

      {photos.length > 0 ? (
        <View style={styles.photoWrap}>
          <Image source={{ uri: photos[0] }} style={styles.photo} />
          <View style={styles.photoCountBadge}>
            <Text style={[typography.micro, { color: colors.white, fontFamily: `${font}Bold` }]}>
              {photos.length}/8
            </Text>
          </View>
          <TouchableOpacity style={styles.removePhoto} onPress={() => setPhotos(prev => prev.slice(1))}>
            <X size={18} color={colors.white} />
          </TouchableOpacity>
          {photos.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoThumbRow}
            >
              {photos.map((uri, index) => (
                <View key={`${uri}-${index}`} style={styles.photoThumb}>
                  <Image source={{ uri }} style={styles.photoThumbImg} />
                  <TouchableOpacity
                    style={styles.removeThumb}
                    onPress={() => setPhotos(prev => prev.filter((_, i) => i !== index))}
                  >
                    <X size={12} color={colors.white} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
          <View style={styles.photoPickerCompact}>
            <TouchableOpacity style={styles.photoBtnCompact} onPress={pickPhoto}>
              <Camera size={18} color={colors.primary} />
              <Text style={[typography.small, { color: colors.primary, fontFamily: `${font}SemiBold` }]}>{t('camera')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoBtnCompact} onPress={pickFromGallery}>
              <UtensilsCrossed size={18} color={colors.primary} />
              <Text style={[typography.small, { color: colors.primary, fontFamily: `${font}SemiBold` }]}>{t('gallery')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.photoPicker}>
          <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
            <Camera size={28} color={colors.primary} />
            <Text style={[typography.small, { color: colors.primary, fontFamily: `${font}SemiBold` }]}>{t('camera')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoBtn} onPress={pickFromGallery}>
            <UtensilsCrossed size={28} color={colors.primary} />
            <Text style={[typography.small, { color: colors.primary, fontFamily: `${font}SemiBold` }]}>{t('gallery')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <TextInput
        style={styles.textInput}
        placeholder={t('foodName')}
        value={foodName}
        onChangeText={setFoodName}
        placeholderTextColor={colors.brownMuted}
      />

      <TextInput
        style={[styles.textInput, { minHeight: 80, textAlignVertical: 'top' }]}
        placeholder={t('foodDescription')}
        value={description}
        onChangeText={setDescription}
        placeholderTextColor={colors.brownMuted}
        multiline
      />

      <TextInput style={styles.textInput} placeholder={t('allergens')} value={allergens} onChangeText={setAllergens} placeholderTextColor={colors.brownMuted} />

      <Text style={[typography.bodyBold, { color: colors.brown, marginBottom: spacing.sm, fontFamily: `${font}Bold` }]}>
        {t('numberOfMeals')}
      </Text>
      <View style={styles.stepper}>
        <TouchableOpacity style={styles.stepBtn} onPress={() => setMeals((m) => Math.max(1, m - 1))}>
          <Minus size={22} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[typography.huge, { color: colors.brown, minWidth: 60, textAlign: 'center', fontFamily: `${font}ExtraBold` }]}>
          {meals}
        </Text>
        <TouchableOpacity style={styles.stepBtn} onPress={() => setMeals((m) => Math.min(1000, m + 1))}>
          <Plus size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <Text style={[typography.bodyBold, { color: colors.brown, marginBottom: spacing.sm, fontFamily: `${font}Bold` }]}>
        {t('setExpiry')}
      </Text>
      <TouchableOpacity style={styles.expiryPicker} onPress={() => setShowExpiryPicker(!showExpiryPicker)}>
        <Calendar size={20} color={colors.goldenDark} />
        <Text style={[typography.body, { color: colors.brown, flex: 1, fontFamily: `${font}SemiBold` }]}>
          {fmtExpiry(expiresAt)} — {new Date(expiresAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
        </Text>
        <Clock size={18} color={colors.warning} />
      </TouchableOpacity>

      {showExpiryPicker && (
        <View style={styles.expiryControls}>
          <View style={styles.expiryField}>
            <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>{t('hours')}</Text>
            <View style={styles.expiryStepper}>
              <TouchableOpacity onPress={() => setExpiryHours(h => Math.min(72, h + 1))}>
                <Plus size={18} color={colors.primary} />
              </TouchableOpacity>
              <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold`, minWidth: 28, textAlign: 'center' }]}>
                {expiryHours}
              </Text>
              <TouchableOpacity onPress={() => setExpiryHours(h => Math.max(0, h - 1))}>
                <Minus size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.expiryField}>
            <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>{t('minutes')}</Text>
            <View style={styles.expiryStepper}>
              <TouchableOpacity onPress={() => setExpiryMinutes(m => Math.min(59, m + 5))}>
                <Plus size={18} color={colors.primary} />
              </TouchableOpacity>
              <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold`, minWidth: 28, textAlign: 'center' }]}>
                {expiryMinutes}
              </Text>
              <TouchableOpacity onPress={() => setExpiryMinutes(m => Math.max(0, m - 5))}>
                <Minus size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={styles.expiryApplyBtn} onPress={applyExpiryDuration}>
            <CheckCircle2 size={18} color={colors.white} />
            <Text style={[typography.small, { color: colors.white, fontFamily: `${font}Bold` }]}>{t('confirm')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {location && (
        <View style={styles.locationBox}>
          <MapPin size={16} color={colors.green} />
          <Text style={[typography.small, { color: colors.greenDark, fontFamily: `${font}SemiBold` }]}>
            {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.publishBtn, submitting && { opacity: 0.5 }]}
        onPress={publish}
        disabled={submitting}
        activeOpacity={0.8}
      >
        {submitting ? <ActivityIndicator color={colors.white} /> : (
          <>
            <HandHeart size={22} color={colors.white} />
            <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>{t('publishFood')}</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function currencyForCountry(country?: string): string {
  const value = (country ?? '').trim().toLowerCase();
  if (value.includes('مصر') || value.includes('egypt')) return 'EGP';
  if (value.includes('الإمارات') || value.includes('الامارات') || value.includes('uae') || value.includes('emirates')) return 'AED';
  if (value.includes('السعود') || value.includes('saudi')) return 'SAR';
  if (value.includes('الكويت') || value.includes('kuwait')) return 'KWD';
  if (value.includes('قطر') || value.includes('qatar')) return 'QAR';
  if (value.includes('البحرين') || value.includes('bahrain')) return 'BHD';
  if (value.includes('عمان') || value.includes('oman')) return 'OMR';
  return 'USD';
}

function MoneyForm({ onBack }: { onBack: () => void }) {
  const { t, language, profile } = useAuth();
  type PricingMealType = { id: string; name: string; description: string; price_usd: number; local_price: number };
  type NearbyRequest = { id: string; meals: number; latitude: number; longitude: number; created_at: string };
  type Charity = { id: string; full_name: string; avatar_url?: string | null; rating?: number | null };
  const [mealPriceUsd, setMealPriceUsd] = useState<number | null>(null);
  const [localPrice, setLocalPrice] = useState<number | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [mealTypeId, setMealTypeId] = useState<string | null>(null);
  const [mealTypes, setMealTypes] = useState<PricingMealType[]>([]);
  const [mealCount, setMealCount] = useState(2);
  const [targetType, setTargetType] = useState<'general' | 'request' | 'charity'>('general');
  const [targetRequestId, setTargetRequestId] = useState<string | null>(null);
  const [targetCharityId, setTargetCharityId] = useState<string | null>(null);
  const [nearbyRequests, setNearbyRequests] = useState<NearbyRequest[]>([]);
  const [charities, setCharities] = useState<Charity[]>([]);
  const [donorLocation, setDonorLocation] = useState<Coords | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [paymentRequired, setPaymentRequired] = useState(false);
  const [pricingLoading, setPricingLoading] = useState(true);
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';

  return (
    <View style={{ paddingHorizontal: spacing.lg }}>
      <BackBar onPress={onBack} />
      <View style={styles.successCard}>
        <View style={[styles.statusIcon, { backgroundColor: colors.warningBg }]}>
          <DollarSign size={40} color={colors.goldenDark} />
        </View>
        <Text style={[typography.title, { color: colors.brown, marginTop: spacing.md, fontFamily: `${font}Bold`, textAlign: 'center' }]}>
          {language === 'ar' ? 'التبرع بقيمة وجبة متوقف مؤقتًا' : 'Meal-value donations are temporarily disabled'}
        </Text>
        <Text style={[typography.body, { color: colors.brownMuted, marginTop: spacing.sm, textAlign: 'center', fontFamily: `${font}Regular` }]}>
          {language === 'ar'
            ? 'لن يتم إنشاء أي عملية دفع أو تبرع مالي الآن. مسار مشاركة الطعام، تحديد الصلاحية، الظهور على الخريطة، الحجز، الشات، والتتبع المباشر ما زال يعمل.'
            : 'No payment or financial donation is created now. Food sharing, expiry, map discovery, booking, chat, and live tracking still work.'}
        </Text>
        <Text style={[typography.small, { color: colors.brownMuted, marginTop: spacing.md, textAlign: 'center', fontFamily: `${font}Regular` }]}>
          {language === 'ar'
            ? 'الكود الخلفي لهذا المسار متوقف أيضًا ويرجع PAYMENTS_DISABLED، ويمكن إعادة تفعيله لاحقًا عند جاهزية بوابة الدفع.'
            : 'The backend path is disabled too and returns PAYMENTS_DISABLED. It can be re-enabled later when a payment gateway is ready.'}
        </Text>
        <TouchableOpacity style={[styles.okBtn, { marginTop: spacing.xl }]} onPress={onBack}>
          <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>{t('confirm')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  useEffect(() => {
    const requestedCurrency = currencyForCountry(profile?.country);
    setCurrency(requestedCurrency);
    setPricingLoading(true);
    apiFetch<{ currency: string; meal_types: Array<{ id: string; price_usd: number; local_price: number }> }>(`/v1/pricing?currency=${requestedCurrency}`)
      .then((result) => {
        const types = result.meal_types as PricingMealType[];
        setMealTypes(types);
        const selected = types.find((item) => item.id === mealTypeId) ?? types[0];
        if (selected) { setMealTypeId(selected.id); setMealPriceUsd(Number(selected.price_usd)); setLocalPrice(Number(selected.local_price)); }
      })
      .catch(async () => {
        if (requestedCurrency !== 'USD') {
          try {
            const result = await apiFetch<{ currency: string; meal_types: Array<{ id: string; price_usd: number; local_price: number }> }>('/v1/pricing?currency=USD');
              const types = result.meal_types as PricingMealType[];
              setMealTypes(types);
              const selected = types.find((item) => item.id === mealTypeId) ?? types[0];
              if (selected) { setCurrency('USD'); setMealTypeId(selected.id); setMealPriceUsd(Number(selected.price_usd)); setLocalPrice(Number(selected.local_price)); }
          } catch { /* show the empty pricing state below */ }
          return;
        }
      })
      .finally(() => setPricingLoading(false));
  }, [profile?.country]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const allowed = await ensureLocationPermission();
      if (!allowed) return;
      const current = await getCurrentLocation();
      if (!current || cancelled) return;
      setDonorLocation(current);
      try {
        const { items } = await apiFetch<{ items: Array<{ item_type: 'request' | 'food'; item_id: string }> }>(
          `/v1/map/nearby?latitude=${encodeURIComponent(current.latitude)}&longitude=${encodeURIComponent(current.longitude)}&radius_km=25`,
        );
        const ids = items.filter((item) => item.item_type === 'request').map((item) => item.item_id);
        if (ids.length === 0) return;
        const { data } = await supabase
          .from('meal_requests')
          .select('id,meals,latitude,longitude,created_at')
          .in('id', ids)
          .eq('status', 'open')
          .neq('user_id', profile?.id ?? '')
          .order('created_at', { ascending: false });
        if (!cancelled) setNearbyRequests((data ?? []) as NearbyRequest[]);
      } catch { /* the general donation option remains available */ }
    })();
    return () => { cancelled = true; };
  }, [profile?.id]);

  useEffect(() => {
    apiFetch<{ items: Charity[] }>('/v1/charities')
      .then((result) => setCharities(result.items ?? []))
      .catch(() => setCharities([]));
  }, []);

  const total = (localPrice ?? 0) * mealCount;

  const submit = async () => {
    if (!mealPriceUsd || !mealTypeId || mealCount < 1 || (targetType === 'request' && !targetRequestId) || (targetType === 'charity' && !targetCharityId)) {
      Alert.alert(t('errorGeneric'));
      return;
    }
    Alert.alert(language === 'ar' ? 'التبرعات المالية متوقفة مؤقتًا' : 'Financial donations are temporarily disabled');

    /*
    setSubmitting(true);
    const { result, error } = await apiPost<{ payment_required: boolean }>('/v1/donations/intent', {
      meal_type_id: mealTypeId,
      meal_count: mealCount,
      currency,
      target_type: targetType,
      target_request_id: targetRequestId,
      target_charity_id: targetCharityId,
      payment_method: 'card',
    }).then((data) => ({ result: data, error: null as unknown })).catch((err) => ({ result: null, error: err }));
    setSubmitting(false);
    if (error) {
      Alert.alert(t('errorGeneric'));
      return;
    }
    setPaymentRequired(Boolean(result?.payment_required));
    setDone(true);
    */
  };

  if (done) {
    return (
      <View style={styles.successCard}>
        <BackBar onPress={onBack} />
        <View style={[styles.statusIcon, { backgroundColor: colors.greenBg }]}>
          <CheckCircle2 size={48} color={colors.green} />
        </View>
        <Text style={[typography.title, { color: colors.greenDark, marginTop: spacing.md, fontFamily: `${font}Bold`, textAlign: 'center' }]}>
          {paymentRequired ? t('donationPending') : t('donationSuccess')}
        </Text>
        <Text style={[typography.huge, { color: colors.brown, marginTop: spacing.sm, fontFamily: `${font}ExtraBold` }]}>
          {total.toFixed(2)} {currency}
        </Text>
        <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
          {mealCount} {t('meals')} × {(localPrice ?? 0).toFixed(2)} {currency}
        </Text>
        <TouchableOpacity style={styles.okBtn} onPress={() => { setDone(false); onBack(); }}>
          <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>{t('confirm')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: spacing.lg }}>
      <BackBar onPress={onBack} />

      <Text style={[typography.bodyBold, { color: colors.brown, marginBottom: spacing.sm, fontFamily: `${font}Bold` }]}>
        {t('mealPrice')} (USD)
      </Text>
      <View style={styles.priceRow}>
        <Text style={[typography.bodyBold, { color: colors.brown, flex: 1, fontFamily: `${font}Bold` }]}>
          {pricingLoading ? '...' : `${(mealPriceUsd ?? 0).toFixed(2)} USD`}
        </Text>
        <Text style={[typography.bodyBold, { color: colors.brownMuted, fontFamily: `${font}SemiBold` }]}>
          {t('perMeal')}
        </Text>
      </View>

      {mealTypes.length > 0 && (
        <>
          <Text style={[typography.bodyBold, { color: colors.brown, marginTop: spacing.md, marginBottom: spacing.sm, fontFamily: `${font}Bold` }]}>
            {language === 'ar' ? 'نوع الوجبة' : 'Meal type'}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {mealTypes.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.targetChip, mealTypeId === item.id && styles.targetChipActive]}
                onPress={() => { setMealTypeId(item.id); setMealPriceUsd(Number(item.price_usd)); setLocalPrice(Number(item.local_price)); }}
                activeOpacity={0.8}
              >
                <Text style={[typography.small, { color: mealTypeId === item.id ? colors.white : colors.brown, fontFamily: `${font}Bold` }]}>{item.name}</Text>
                <Text style={[typography.micro, { color: mealTypeId === item.id ? colors.white : colors.brownMuted, fontFamily: `${font}Regular` }]}>{Number(item.local_price).toFixed(2)} {currency}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      <Text style={[typography.bodyBold, { color: colors.brown, marginTop: spacing.md, marginBottom: spacing.sm, fontFamily: `${font}Bold` }]}>
        {language === 'ar' ? 'وجهة التبرع' : 'Donation target'}
      </Text>
      <View style={styles.targetRow}>
        <TouchableOpacity style={[styles.targetOption, targetType === 'general' && styles.targetOptionActive]} onPress={() => { setTargetType('general'); setTargetRequestId(null); setTargetCharityId(null); }} activeOpacity={0.8}>
          <Heart size={16} color={targetType === 'general' ? colors.white : colors.coral} />
          <Text style={[typography.small, { color: targetType === 'general' ? colors.white : colors.brown, fontFamily: `${font}Bold` }]}>{language === 'ar' ? 'تبرع عام' : 'General'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.targetOption, targetType === 'request' && styles.targetOptionActive, nearbyRequests.length === 0 && { opacity: 0.45 }]}
          onPress={() => { if (nearbyRequests.length > 0) { setTargetType('request'); setTargetCharityId(null); } }}
          disabled={nearbyRequests.length === 0}
          activeOpacity={0.8}
        >
          <MapPin size={16} color={targetType === 'request' ? colors.white : colors.green} />
          <Text style={[typography.small, { color: targetType === 'request' ? colors.white : colors.brown, fontFamily: `${font}Bold` }]}>{language === 'ar' ? 'طلب قريب' : 'Nearby request'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.targetOption, targetType === 'charity' && styles.targetOptionActive, charities.length === 0 && { opacity: 0.45 }]}
          onPress={() => { if (charities.length > 0) { setTargetType('charity'); setTargetRequestId(null); } }}
          disabled={charities.length === 0}
          activeOpacity={0.8}
        >
          <Building2 size={16} color={targetType === 'charity' ? colors.white : colors.primary} />
          <Text style={[typography.small, { color: targetType === 'charity' ? colors.white : colors.brown, fontFamily: `${font}Bold` }]}>{language === 'ar' ? 'جمعية' : 'Charity'}</Text>
        </TouchableOpacity>
      </View>
      {targetType === 'request' && (
        <View style={styles.targetList}>
          {nearbyRequests.map((request) => {
            const selected = request.id === targetRequestId;
            return (
              <TouchableOpacity key={request.id} style={[styles.targetRequest, selected && styles.targetRequestActive]} onPress={() => setTargetRequestId(request.id)} activeOpacity={0.8}>
                <MapPin size={16} color={selected ? colors.white : colors.green} />
                <Text style={[typography.small, { color: selected ? colors.white : colors.brown, flex: 1, fontFamily: `${font}SemiBold` }]}>
                  {request.meals} {t('meals')} · {language === 'ar' ? 'طلب مفتوح قريب' : 'Open nearby request'}
                </Text>
                <Text style={[typography.micro, { color: selected ? colors.white : colors.brownMuted, fontFamily: `${font}Regular` }]}>
                  {donorLocation ? haversineKm(donorLocation, { latitude: request.latitude, longitude: request.longitude }).toFixed(1) : '—'} {t('km')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      {targetType === 'charity' && (
        <View style={styles.targetList}>
          {charities.map((charity) => {
            const selected = charity.id === targetCharityId;
            return (
              <TouchableOpacity key={charity.id} style={[styles.targetRequest, selected && styles.targetRequestActive]} onPress={() => setTargetCharityId(charity.id)} activeOpacity={0.8}>
                <Building2 size={16} color={selected ? colors.white : colors.primary} />
                <Text style={[typography.small, { color: selected ? colors.white : colors.brown, flex: 1, fontFamily: `${font}SemiBold` }]}>{charity.full_name}</Text>
                {typeof charity.rating === 'number' && <Text style={[typography.micro, { color: selected ? colors.white : colors.brownMuted, fontFamily: `${font}Regular` }]}>★ {charity.rating.toFixed(1)}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <Text style={[typography.bodyBold, { color: colors.brown, marginTop: spacing.md, marginBottom: spacing.sm, fontFamily: `${font}Bold` }]}>
        {t('mealCount')}
      </Text>
      <View style={styles.stepper}>
        <TouchableOpacity style={styles.stepBtn} onPress={() => setMealCount((m) => Math.max(1, m - 1))}>
          <Minus size={22} color={colors.goldenDark} />
        </TouchableOpacity>
        <Text style={[typography.huge, { color: colors.brown, minWidth: 60, textAlign: 'center', fontFamily: `${font}ExtraBold` }]}>
          {mealCount}
        </Text>
        <TouchableOpacity style={styles.stepBtn} onPress={() => setMealCount((m) => Math.min(1000, m + 1))}>
          <Plus size={22} color={colors.goldenDark} />
        </TouchableOpacity>
      </View>

      <View style={styles.totalCard}>
        <View style={styles.totalLeft}>
          <DollarSign size={22} color={colors.goldenDark} />
          <Text style={[typography.body, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
            {t('totalAmount')}
          </Text>
        </View>
        <Text style={[typography.huge, { color: colors.goldenDark, fontFamily: `${font}ExtraBold` }]}>
          {total.toFixed(2)} {currency}
        </Text>
      </View>
      <Text style={[typography.small, { color: colors.brownMuted, textAlign: 'center', marginBottom: spacing.lg, fontFamily: `${font}Regular` }]}>
        {mealCount} {t('meals')} × {(localPrice ?? 0).toFixed(2)} {currency}
      </Text>

      <TouchableOpacity style={styles.publishBtn} onPress={submit} disabled={submitting || pricingLoading || !mealTypeId} activeOpacity={0.8}>
        {submitting ? <ActivityIndicator color={colors.white} /> : (
          <>
            <DollarSign size={22} color={colors.white} />
            <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>{t('donateMoney')}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

interface RequestWithProfile extends MealRequest {
  requester_profile: Profile;
  distance_km: number | null;
}

function RequestsList({ onBack }: { onBack: () => void }) {
  const { t, language, user, profile, settings } = useAuth();
  const [requests, setRequests] = useState<RequestWithProfile[]>([]);
  const [location, setLocation] = useState<Coords | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [matchRequest, setMatchRequest] = useState<MealRequest | null>(null);
  const [matchProfile, setMatchProfile] = useState<Profile | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';
  const rtl = language === 'ar';
  const knownRequestIds = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!user || !location) {
      setRequests([]);
      setLoading(false);
      return;
    }
    let data: any[] | null = null;
    try {
      const { items } = await apiFetch<{ items: NearbyRequestMapItem[] }>(
        `/v1/map/nearby?latitude=${encodeURIComponent(location.latitude)}&longitude=${encodeURIComponent(location.longitude)}&radius_km=25`,
      );
      const requestIds = items.filter(item => item.item_type === 'request').map(item => item.item_id);
      if (requestIds.length > 0) {
        const result = await supabase.rpc('get_nearby_request_details', { p_ids: requestIds });
        const fallback = items.filter(item => item.item_type === 'request').map(mapItemToRequest);
        data = result.error || !result.data?.length ? fallback : result.data as any[];
      } else {
        data = [];
      }
    } catch {
      setRequests([]);
      setLoading(false);
      return;
    }

    const openReqs = (data ?? []) as MealRequest[];
    if (openReqs.length === 0) {
      setRequests([]);
      setLoading(false);
      return;
    }

    const profileIds = [...new Set(openReqs.map(r => r.user_id))];
    const { data: profiles } = await supabase
      .from('public_profiles')
      .select('*')
      .in('id', profileIds);
    const profileMap = new Map<string, Profile>();
    (profiles ?? []).forEach(p => profileMap.set((p as Profile).id, p as Profile));

    const enriched: RequestWithProfile[] = openReqs.map(r => ({
      ...r,
      requester_profile: profileMap.get(r.user_id) ?? ({ id: r.user_id, full_name: '?', email: '', role: 'needer', language: 'ar', phone: '', country: '', avatar_url: null, rating: 0, meals_helped: 0, meals_received: 0, created_at: '', updated_at: '' } as Profile),
      distance_km: location ? haversineKm(location, { latitude: r.latitude, longitude: r.longitude }) : null,
    }));

    // Detect new requests for sound/vibration
    const newIds = enriched.filter(r => !knownRequestIds.current.has(r.id));
    if (knownRequestIds.current.size > 0 && newIds.length > 0) {
      if (settings?.request_sound_enabled) playNotificationSound();
      if (settings?.vibration_enabled) vibrateDevice();
      if (settings?.notifications_enabled) notifyIncomingRequest('SHARek - طلب وجبة قريب', `${newIds.length} طلب جديد قريب منك`);
    }
    enriched.forEach(r => knownRequestIds.current.add(r.id));

    setRequests(enriched);
    setLoading(false);
  }, [user, location, settings]);

  // Check if donor already has an active match
  const checkActiveMatch = useCallback(async () => {
    if (!user) return;
    const { data: matches } = await supabase
      .from('matches')
      .select('*')
      .eq('helper_id', user.id)
      .in('status', ['accepted', 'completed'])
      .order('created_at', { ascending: false })
      .limit(1);
    if (matches && matches.length > 0) {
       const m = matches[0] as Match;
      if (m.status === 'accepted' || m.delivery_status !== 'delivered') {
        setActiveMatch(m as Match);
        const { data: req } = await supabase
          .from('meal_requests')
          .select('*')
          .eq('id', (m as Match).request_id)
          .maybeSingle();
        if (req) setMatchRequest(req as MealRequest);
        const { data: prof } = await supabase
          .from('public_profiles')
          .select('*')
          .eq('id', (req as MealRequest)?.user_id ?? '')
          .maybeSingle();
        if (prof) setMatchProfile(prof as Profile);
      }
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    let sub: ReturnType<typeof supabase.channel> | null = null;
    const initialize = async () => {
      // Expire stale open requests older than 60s
      await supabase.rpc('expire_stale_requests');
      const ok = await ensureLocationPermission();
      if (!cancelled && ok) {
        const c = await getCurrentLocation();
        if (!cancelled && c) setLocation(c);
      }
      if (cancelled) return;
      void checkActiveMatch();
      void load();
      sub = supabase
        .channel('open_requests_realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'meal_requests' }, load)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'meal_requests' }, load)
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'meal_requests' }, load)
        .subscribe();
    };
    void initialize();
    return () => {
      cancelled = true;
      if (sub) void supabase.removeChannel(sub);
    };
  }, [load, checkActiveMatch]);

  // Realtime for active match updates
  useEffect(() => {
    if (!activeMatch) return;
    const sub = supabase
      .channel(`match_${activeMatch.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'matches',
        filter: `id=eq.${activeMatch.id}`,
      }, (payload) => {
        const updated = payload.new as Match;
        setActiveMatch(updated);
        if (updated.delivery_status === 'delivered') {
          setTimeout(() => { setActiveMatch(null); setMatchRequest(null); setMatchProfile(null); load(); }, 2500);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [activeMatch, load]);

  // Stream helper GPS only while the match is active; cleanup stops sharing after completion/cancellation.
  useEffect(() => {
    if (!activeMatch) return;
    let cleanup: (() => void) | undefined;
    let alive = true;
    (async () => {
      cleanup = await watchLocation((coords) => {
        if (!alive) return;
        setLocation(coords);
        apiPost(`/v1/matches/${activeMatch.id}/location`, coords).catch(() => undefined);
      });
    })();
    return () => { alive = false; cleanup?.(); };
  }, [activeMatch]);

  const accept = async (req: RequestWithProfile) => {
    if (!user) return;
    setActionId(req.id);
    const { data: matchData, error } = await apiPost<Match>(`/v1/meal-requests/${req.id}/accept`, {
      latitude: location?.latitude,
      longitude: location?.longitude,
    }).then((data) => ({ data, error: null as unknown })).catch((err) => ({ data: null, error: err }));
    setActionId(null);
    if (error) {
      Alert.alert(t('errorGeneric'), error.message);
      return;
    }
    const m = matchData as unknown as Match;
    setActiveMatch(m);
    setMatchRequest(req);
    setMatchProfile(req.requester_profile);
    setRequests(prev => prev.filter(r => r.id !== req.id));
  };

  const decline = (req: RequestWithProfile) => {
    setRequests(prev => prev.filter(r => r.id !== req.id));
  };

  const updateStatus = async (newStatus: 'awaiting_pickup' | 'delivered') => {
    if (!activeMatch) return;
    setUpdatingStatus(true);
    const { error } = await apiPatch<Match>(`/v1/matches/${activeMatch.id}/status`, { status: newStatus })
      .then(() => ({ error: null as unknown })).catch((err) => ({ error: err }));
    setUpdatingStatus(false);
    if (error) {
      Alert.alert(t('errorGeneric'));
      return;
    }
    if (newStatus === 'delivered') {
      // The realtime subscription will handle the state cleanup
    }
  };

  const distText = (dist: number | null) => {
    if (dist === null) return '';
    if (dist < 1) return `${Math.round(dist * 1000)} m`;
    return `${dist.toFixed(1)} ${t('km')}`;
  };

  // --- Matched detail view ---
  if (activeMatch && matchRequest) {
    const ds = activeMatch.delivery_status;
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <BackBar onPress={() => { setActiveMatch(null); setMatchRequest(null); setMatchProfile(null); }} />
        </View>

        {/* Status banner with green theming */}
        <View style={[styles.matchStatusBanner, ds === 'delivered' ? { backgroundColor: colors.successBg } : { backgroundColor: colors.greenBg }]}>
          {ds === 'delivered' ? <PartyPopper size={24} color={colors.greenDark} /> : ds === 'awaiting_pickup' ? <Truck size={24} color={colors.greenDark} /> : <CheckCircle2 size={24} color={colors.greenDark} />}
          <Text style={[typography.bodyBold, { color: colors.greenDark, fontFamily: `${font}Bold` }]}>
            {ds === 'delivered' ? t('matchCompleted') : ds === 'awaiting_pickup' ? t('awaitingPickup') : t('requestAccepted')}
          </Text>
        </View>

        {/* Needy user card */}
        <View style={styles.matchCard}>
          <Text style={[typography.small, { color: colors.brownMuted, marginBottom: spacing.sm, fontFamily: `${font}SemiBold` }]}>
            {t('needyUser')}
          </Text>
          <View style={styles.matchUserRow}>
            <View style={[styles.matchAvatar, { backgroundColor: colors.coral }]}>
              <Text style={[typography.heading, { color: colors.white, fontFamily: `${font}Bold` }]}>
                {matchProfile?.full_name?.charAt(0).toUpperCase() ?? '?'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]} numberOfLines={1}>
                {matchProfile?.full_name ?? '...'}
              </Text>
              <View style={styles.matchMetaRow}>
                {matchProfile && matchProfile.rating > 0 && (
                  <View style={styles.matchMetaItem}>
                    <Star size={12} color={colors.golden} fill={colors.golden} />
                    <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}SemiBold` }]}>{matchProfile.rating.toFixed(1)}</Text>
                  </View>
                )}
                <View style={styles.matchMetaItem}>
                  <Heart size={12} color={colors.coral} />
                  <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}SemiBold` }]}>{matchRequest.meals} {t('meals')}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.matchDetails}>
            <View style={styles.matchDetailCell}>
              <Text style={[typography.micro, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>{t('requestMeals')}</Text>
              <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]}>{matchRequest.meals}</Text>
            </View>
            <View style={styles.matchDetailCell}>
              <Text style={[typography.micro, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>{t('requestTiming')}</Text>
              <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]}>{matchRequest.timing === 'now' ? t('now') : t('later')}</Text>
            </View>
          </View>
        </View>

        {/* Live GPS map with both parties */}
        <LiveMatchMap
          requesterLat={activeMatch.requester_lat ?? matchRequest.latitude}
          requesterLng={activeMatch.requester_lng ?? matchRequest.longitude}
          helperLat={activeMatch.helper_lat}
          helperLng={activeMatch.helper_lng}
          userRole="helper"
          font={font}
          distLabel={t('liveDistance')}
          helperLabel={t('helperLocation')}
          requesterLabel={t('requesterLocation')}
        />

        {/* Chat button */}
        <TouchableOpacity
          style={[styles.matchChatBtn, { backgroundColor: colors.green }]}
          onPress={() => router.push({
            pathname: '/chat',
            params: { mealRequestId: matchRequest.id, otherUserId: matchRequest.user_id },
          })}
          activeOpacity={0.8}
        >
          <MessageCircle size={20} color={colors.white} />
          <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>{t('openChat')}</Text>
        </TouchableOpacity>

        {/* Status progression buttons with green theming */}
        {ds === 'accepted' && (
          <TouchableOpacity
            style={[styles.matchStatusBtn, { backgroundColor: colors.goldenDark }]}
            onPress={() => updateStatus('awaiting_pickup')}
            disabled={updatingStatus}
            activeOpacity={0.8}
          >
            {updatingStatus ? <ActivityIndicator color={colors.white} size={18} /> : (
              <>
                <Truck size={20} color={colors.white} />
                <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>{t('markAwaitingPickup')}</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {ds === 'awaiting_pickup' && (
          <TouchableOpacity
            style={[styles.matchStatusBtn, { backgroundColor: colors.green }]}
            onPress={() => updateStatus('delivered')}
            disabled={updatingStatus}
            activeOpacity={0.8}
          >
            {updatingStatus ? <ActivityIndicator color={colors.white} size={18} /> : (
              <>
                <PackageCheck size={20} color={colors.white} />
                <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>{t('markDelivered')}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  }

  // --- Loading state ---
  if (loading) {
    return (
      <View style={{ paddingHorizontal: spacing.lg }}>
        <BackBar onPress={onBack} />
        <ActivityIndicator color={colors.primary} style={{ paddingVertical: spacing.xl }} />
      </View>
    );
  }

  // --- Waiting / empty state ---
  if (requests.length === 0) {
    return (
      <View style={{ paddingHorizontal: spacing.lg }}>
        <BackBar onPress={onBack} />
        <View style={styles.waitingWrap}>
          <View style={styles.waitingCircle}>
            <Loader2 size={40} color={colors.primary} />
          </View>
          <Text style={[typography.title, { color: colors.brown, marginTop: spacing.lg, textAlign: 'center', fontFamily: `${font}Bold` }]}>
            {t('waitingForRequests')}
          </Text>
          <Text style={[typography.body, { color: colors.brownMuted, textAlign: 'center', marginTop: spacing.xs, fontFamily: `${font}Regular` }]}>
            {t('noActiveRequests')}
          </Text>
        </View>
      </View>
    );
  }

  // --- Incoming request cards (InDrive style) ---
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.incomingHeader}>
        <Bell size={18} color={colors.coral} />
        <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]}>
          {t('newRequestIncoming')}
        </Text>
        <View style={styles.incomingCountBadge}>
          <Text style={[typography.micro, { color: colors.white, fontFamily: `${font}Bold` }]}>{requests.length}</Text>
        </View>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 120, gap: spacing.md }} showsVerticalScrollIndicator={false}>
        {requests.map((r) => (
          <View key={r.id} style={styles.incomingCard}>
            {/* Alert badge + countdown */}
            <View style={styles.incomingBadgeRow}>
              <View style={styles.incomingBadge}>
                <Bell size={10} color={colors.white} />
                <Text style={[typography.micro, { color: colors.white, fontFamily: `${font}Bold` }]}>
                  {t('newRequestNearby')}
                </Text>
              </View>
              <RequestCountdown createdAt={r.created_at} font={font} onExpire={() => decline(r)} />
            </View>

            {/* User header */}
            <View style={styles.incomingUserRow}>
              <View style={[styles.incomingAvatar, { backgroundColor: colors.coral }]}>
                <Text style={[typography.heading, { color: colors.white, fontFamily: `${font}Bold` }]}>
                  {r.requester_profile.full_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]} numberOfLines={1}>
                  {r.requester_profile.full_name}
                </Text>
                <View style={styles.incomingMetaRow}>
                  {r.requester_profile.rating > 0 && (
                    <View style={styles.incomingMetaItem}>
                      <Star size={11} color={colors.golden} fill={colors.golden} />
                      <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}SemiBold` }]}>{r.requester_profile.rating.toFixed(1)}</Text>
                    </View>
                  )}
                  {r.distance_km !== null && (
                    <View style={styles.incomingMetaItem}>
                      <Navigation size={11} color={colors.greenDark} />
                      <Text style={[typography.small, { color: colors.greenDark, fontFamily: `${font}SemiBold` }]}>{distText(r.distance_km)}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Details row */}
            <View style={styles.incomingDetails}>
              <View style={styles.incomingDetailCell}>
                <Heart size={14} color={colors.coral} />
                <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>{t('requestMeals')}</Text>
                <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]}>{r.meals}</Text>
              </View>
              <View style={styles.incomingDetailCell}>
                <Clock size={14} color={colors.goldenDark} />
                <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>{t('requestTiming')}</Text>
                <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]}>{r.timing === 'now' ? t('now') : t('later')}</Text>
              </View>
            </View>

            {/* Pickup location */}
            <View style={styles.incomingLocation}>
              <MapPin size={14} color={colors.green} />
              <Text style={[typography.small, { color: colors.greenDark, fontFamily: `${font}SemiBold` }]}>
                {t('pickupLocation')}: {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
              </Text>
            </View>

            {/* Accept / Decline buttons */}
            <View style={styles.incomingActions}>
              <TouchableOpacity
                style={[styles.incomingBtn, styles.incomingDeclineBtn]}
                onPress={() => decline(r)}
                disabled={actionId === r.id}
                activeOpacity={0.7}
              >
                <X size={20} color={colors.error} />
                <Text style={[typography.bodyBold, { color: colors.error, fontFamily: `${font}Bold` }]}>
                  {t('rejectRequest')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.incomingBtn, styles.incomingAcceptBtn]}
                onPress={() => accept(r)}
                disabled={actionId === r.id}
                activeOpacity={0.8}
              >
                {actionId === r.id ? <ActivityIndicator color={colors.white} size={18} /> : (
                  <>
                    <CheckCircle2 size={20} color={colors.white} />
                    <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>
                      {t('acceptOrder')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function RequestCountdown({ createdAt, font, onExpire }: { createdAt: string; font: string; onExpire: () => void }) {
  const [seconds, setSeconds] = useState(() => {
    const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
    return Math.max(0, 15 - elapsed);
  });

  useEffect(() => {
    if (seconds <= 0) {
      onExpire();
      return;
    }
    const id = setTimeout(() => setSeconds(s => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds, onExpire]);

  const pct = seconds / 15;
  const color = seconds <= 5 ? colors.error : seconds <= 10 ? colors.goldenDark : colors.green;

  return (
    <View style={styles.countdownWrap}>
      <View style={styles.countdownCircle}>
        <Text style={[typography.small, { color, fontFamily: `${font}Bold`, fontSize: 13 }]}>
          {seconds}s
        </Text>
      </View>
      <View style={styles.countdownBarBg}>
        <View style={[styles.countdownBarFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function ClaimedList({ onBack }: { onBack: () => void }) {
  const { t, language, user } = useAuth();
  const [claims, setClaims] = useState<Array<{ claim: FoodClaim; donation: FoodDonation }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [claimLocation, setClaimLocation] = useState<Coords | null>(null);
  const [claimActionId, setClaimActionId] = useState<string | null>(null);
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';
  const rtl = language === 'ar';

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('food_claims')
      .select('*, food_donation:food_donations(*)')
      .eq('claimer_id', user.id)
      .order('created_at', { ascending: false });
    if (data) {
      setClaims(data.map((c: any) => ({ claim: c as FoodClaim, donation: c.food_donation as FoodDonation })));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    const sub = supabase
      .channel('my_claims_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_claims' }, load)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [load]);

  const selectedClaim = claims.find(item => item.claim.id === selectedClaimId) ?? null;

  useEffect(() => {
    if (!selectedClaim || selectedClaim.claim.status !== 'booked') return;
    let cleanup: (() => void) | undefined;
    let alive = true;
    (async () => {
      cleanup = await watchLocation((coords) => {
        if (!alive) return;
        setClaimLocation(coords);
        apiPost(`/v1/food-claims/${selectedClaim.claim.id}/location`, coords).catch(() => undefined);
      });
    })();
    return () => { alive = false; cleanup?.(); };
  }, [selectedClaim?.claim.id, selectedClaim?.claim.status]);

  const confirmPickup = async (claimId: string) => {
    setClaimActionId(claimId);
    const { error } = await apiPost<any>(`/v1/food-claims/${claimId}/confirm-pickup`)
      .then(() => ({ error: null as unknown })).catch((err) => ({ error: err }));
    setClaimActionId(null);
    if (error) { Alert.alert(t('errorGeneric')); return; }
    setSelectedClaimId(null);
    setClaimLocation(null);
    load();
  };

  if (loading) {
    return (
      <View style={{ paddingHorizontal: spacing.lg }}>
        <BackBar onPress={onBack} />
        <ActivityIndicator color={colors.primary} style={{ paddingVertical: spacing.xl }} />
      </View>
    );
  }

  if (claims.length === 0) {
    return (
      <View style={{ paddingHorizontal: spacing.lg }}>
        <BackBar onPress={onBack} />
        <View style={styles.emptyWrap}>
          <MessageCircle size={40} color={colors.brownMuted} />
          <Text style={[typography.body, { color: colors.brownMuted, marginTop: spacing.md, fontFamily: `${font}Regular` }]}>
            {t('noMessages')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
      <BackBar onPress={onBack} />
      {claims.map(({ claim, donation }) => (
        <View key={claim.id} style={styles.requestCard}>
          <View style={styles.requestHeader}>
            {getPrimaryFoodImage(donation) ? (
              <Image source={{ uri: getPrimaryFoodImage(donation)! }} style={styles.claimFoodImg} />
            ) : (
              <View style={[styles.claimFoodImg, { backgroundColor: colors.greenBg, justifyContent: 'center', alignItems: 'center' }]}>
                <UtensilsCrossed size={18} color={colors.green} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]} numberOfLines={1}>
                {donation.food_name}
              </Text>
              <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                {donation.meals} {t('meals')} · {claim.status}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.acceptBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push({ pathname: '/chat', params: { donationId: donation.id, otherUserId: donation.user_id } })}
            activeOpacity={0.8}
          >
            <MessageCircle size={18} color={colors.white} />
            <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>
              {t('chatNow')}
            </Text>
          </TouchableOpacity>
          {claim.status === 'booked' && (
            <>
              <TouchableOpacity
                style={[styles.acceptBtn, { backgroundColor: colors.green }]}
                onPress={() => setSelectedClaimId(selectedClaimId === claim.id ? null : claim.id)}
                activeOpacity={0.8}
              >
                <Navigation size={18} color={colors.white} />
                <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>{t('trackPickup')}</Text>
              </TouchableOpacity>
              {selectedClaimId === claim.id && (
                <>
                  <LiveMatchMap
                    requesterLat={claimLocation?.latitude ?? donation.latitude}
                    requesterLng={claimLocation?.longitude ?? donation.longitude}
                    helperLat={donation.latitude}
                    helperLng={donation.longitude}
                    userRole="requester"
                    font={font}
                    distLabel={t('liveDistance')}
                    helperLabel={t('pickupLocation')}
                    requesterLabel={t('currentLocation')}
                  />
                  <TouchableOpacity
                    style={[styles.acceptBtn, { backgroundColor: colors.primary }]}
                    onPress={() => confirmPickup(claim.id)}
                    disabled={claimActionId === claim.id}
                    activeOpacity={0.8}
                  >
                    {claimActionId === claim.id ? <ActivityIndicator color={colors.white} /> : <PackageCheck size={18} color={colors.white} />}
                    <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>{t('confirmReceipt')}</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerCard: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg, paddingTop: spacing.xl, paddingHorizontal: spacing.lg },
  headerIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  backBar: { paddingVertical: spacing.sm, marginBottom: spacing.sm, alignSelf: 'flex-start' },
  choiceCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1.5, borderColor: colors.border,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  choiceIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  photoWrap: { position: 'relative', marginBottom: spacing.md },
  photo: { width: '100%', height: 180, borderRadius: radius.md },
  removePhoto: { position: 'absolute', top: spacing.sm, right: spacing.sm, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center' },
  photoCountBadge: { position: 'absolute', top: spacing.sm, left: spacing.sm, minWidth: 42, height: 28, borderRadius: 14, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.sm },
  photoThumbRow: { gap: spacing.sm, paddingTop: spacing.sm },
  photoThumb: { width: 58, height: 58, borderRadius: radius.sm, overflow: 'hidden', position: 'relative', backgroundColor: colors.surfaceAlt },
  photoThumbImg: { width: '100%', height: '100%' },
  removeThumb: { position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center' },
  photoPicker: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  photoPickerCompact: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  photoBtnCompact: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingVertical: spacing.sm,
    borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed',
  },
  photoBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingVertical: spacing.lg,
    borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed',
  },
  textInput: {
    ...typography.body, color: colors.brown,
    backgroundColor: colors.surfaceAlt, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  stepper: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, paddingVertical: spacing.md,
    borderWidth: 1.5, borderColor: colors.border, marginBottom: spacing.md,
  },
  stepBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.white,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2,
  },
  expiryPicker: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.warningBg, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    marginBottom: spacing.md, borderWidth: 1.5, borderColor: colors.golden,
  },
  expiryControls: {
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1.5, borderColor: colors.border, gap: spacing.sm,
  },
  expiryField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  expiryStepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  expiryApplyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.goldenDark, borderRadius: radius.md, paddingVertical: spacing.sm, marginTop: spacing.xs,
  },
  locationBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.greenBg, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    alignSelf: 'flex-start', marginBottom: spacing.lg,
  },
  publishBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.green, borderRadius: radius.md, paddingVertical: spacing.md,
    shadowColor: colors.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  targetChip: { minWidth: 132, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1.5, borderColor: colors.border, gap: 2 },
  targetChipActive: { backgroundColor: colors.green, borderColor: colors.green },
  targetRow: { flexDirection: 'row', gap: spacing.sm },
  targetOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingVertical: spacing.sm, borderWidth: 1.5, borderColor: colors.border },
  targetOptionActive: { backgroundColor: colors.green, borderColor: colors.green },
  targetList: { gap: spacing.xs, marginTop: spacing.sm },
  targetRequest: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderWidth: 1.5, borderColor: colors.border },
  targetRequestActive: { backgroundColor: colors.green, borderColor: colors.green },
  totalCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.warningBg, borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderWidth: 2, borderColor: colors.golden, marginTop: spacing.md,
  },
  totalLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  successCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border, marginHorizontal: spacing.lg,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 16, elevation: 4,
  },
  statusIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  okBtn: {
    backgroundColor: colors.green, borderRadius: radius.md, paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl, marginTop: spacing.lg,
  },
  emptyWrap: { alignItems: 'center', paddingVertical: spacing.xxl },
  requestCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1.5, borderColor: colors.border,
  },
  requestHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  requestIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  acceptBtn: {
    backgroundColor: colors.green, borderRadius: radius.md, paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  claimFoodImg: { width: 44, height: 44, borderRadius: 22 },
  waitingWrap: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
  waitingCircle: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: colors.surfaceAlt,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.border,
  },
  incomingHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface, borderBottomWidth: 1.5, borderColor: colors.border,
  },
  incomingCountBadge: {
    minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.coral,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6,
  },
  incomingCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1.5, borderColor: colors.border,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 16, elevation: 4,
  },
  incomingBadgeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  incomingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.coral, borderRadius: radius.pill,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  countdownWrap: { alignItems: 'flex-end', gap: 3 },
  countdownCircle: {
    minWidth: 34, height: 24, borderRadius: 12, paddingHorizontal: 6,
    backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border,
  },
  countdownBarBg: {
    width: 50, height: 4, borderRadius: 2, backgroundColor: colors.border,
  },
  countdownBarFill: {
    height: 4, borderRadius: 2,
  },
  incomingUserRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  incomingAvatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  incomingMetaRow: { flexDirection: 'row', gap: spacing.md, marginTop: 2 },
  incomingMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  incomingDetails: {
    flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md,
  },
  incomingDetailCell: { flex: 1, gap: 2 },
  incomingLocation: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.greenBg, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  incomingActions: { flexDirection: 'row', gap: spacing.md },
  incomingBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    borderRadius: radius.md, paddingVertical: spacing.md,
  },
  incomingAcceptBtn: {
    backgroundColor: colors.green,
    shadowColor: colors.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  incomingDeclineBtn: {
    backgroundColor: colors.errorBg, borderWidth: 1.5, borderColor: colors.error,
  },
  matchStatusBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    marginHorizontal: spacing.lg, borderRadius: radius.lg, paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  matchCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1.5, borderColor: colors.border, marginHorizontal: spacing.lg, marginBottom: spacing.md,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  matchUserRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  matchAvatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  matchMetaRow: { flexDirection: 'row', gap: spacing.md, marginTop: 2 },
  matchMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  matchDetails: {
    flexDirection: 'row', gap: spacing.md,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md,
  },
  matchDetailCell: { flex: 1 },
  matchMapCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1.5, borderColor: colors.border, marginHorizontal: spacing.lg, marginBottom: spacing.md,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  matchMapHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  matchMapIframe: {
    width: '100%', height: 200, borderRadius: radius.md, borderWidth: 0,
  },
  matchChatBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md,
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  matchStatusBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    borderRadius: radius.md, paddingVertical: spacing.md,
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
});

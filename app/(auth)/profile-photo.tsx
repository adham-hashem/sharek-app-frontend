import { useState } from 'react';
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Camera, UserRound } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, radius, spacing, typography } from '@/lib/theme';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function decodeBase64(value: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const cleaned = value.replace(/=+$/, '');
  const output = new Uint8Array(Math.floor(cleaned.length * 3 / 4));
  let bits = 0;
  let buffer = 0;
  let position = 0;
  for (const char of cleaned) {
    const digit = alphabet.indexOf(char);
    if (digit < 0) throw new Error('Invalid image data');
    buffer = (buffer << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output[position++] = (buffer >> bits) & 255;
    }
  }
  return output;
}

export default function ProfilePhotoScreen() {
  const { user, profile, updateProfile, t, language } = useAuth();
  const [picked, setPicked] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';
  const providerPhoto = [profile?.avatar_url, user?.user_metadata?.picture, user?.user_metadata?.avatar_url]
    .find(value => typeof value === 'string' && value.startsWith('https://')) as string | undefined;
  const preview = picked?.uri ?? (imageFailed ? null : providerPhoto);

  const choosePhoto = async () => {
    setError(null);
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { setError(t('photoPermissionRequired')); return; }
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true });
    if (!result.canceled && result.assets[0]) {
      setImageFailed(false);
      setPicked(result.assets[0]);
    }
  };

  const finish = async (skip: boolean) => {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    if (!skip && picked) {
      try {
        const encoded = picked.base64;
        const bytes = encoded
          ? decodeBase64(encoded)
          : picked.file ? new Uint8Array(await picked.file.arrayBuffer()) : null;
        if (!bytes) throw new Error('errorGeneric');
        if (bytes.byteLength > MAX_AVATAR_BYTES) throw new Error('photoTooLarge');
        const contentType = picked.mimeType === 'image/png' || picked.mimeType === 'image/webp' ? picked.mimeType : 'image/jpeg';
        const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
        const { error: uploadError } = await supabase.storage.from('profile-photos').upload(path, bytes, { contentType, upsert: false });
        if (uploadError) throw uploadError;
        const url = supabase.storage.from('profile-photos').getPublicUrl(path).data.publicUrl;
        const saved = await updateProfile({ avatar_url: url });
        if (saved.error) {
          await supabase.storage.from('profile-photos').remove([path]);
          throw new Error('errorGeneric');
        }
      } catch (cause) {
        setBusy(false);
        setError(t(cause instanceof Error && cause.message === 'photoTooLarge' ? 'photoTooLarge' : 'errorGeneric'));
        return;
      }
    } else if (!skip && providerPhoto && !imageFailed && profile?.avatar_url !== providerPhoto) {
      const saved = await updateProfile({ avatar_url: providerPhoto });
      if (saved.error) { setBusy(false); setError(t(saved.error)); return; }
    }
    const { error: markerError } = await supabase.auth.updateUser({ data: { sharek_photo_step_done: true } });
    setBusy(false);
    if (markerError) { setError(t('errorGeneric')); return; }
    router.replace('/');
  };

  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Image source={require('../../assets/images/image copy.png')} style={styles.logo} resizeMode="contain" />
        <Text style={[styles.title, { fontFamily: `${font}Bold` }]}>{t('profilePhotoTitle')}</Text>
        <Text style={[styles.subtitle, { fontFamily: `${font}Regular` }]}>{t('profilePhotoSubtitle')}</Text>
        <View style={styles.avatar}>
          {preview ? <Image source={{ uri: preview }} style={styles.avatarImage} onError={() => setImageFailed(true)} /> : <UserRound size={54} color={colors.brownMuted} strokeWidth={1.5} />}
        </View>
        <TouchableOpacity style={styles.changeButton} onPress={() => void choosePhoto()} disabled={busy}>
          <Camera size={19} color={colors.primary} />
          <Text style={[styles.changeText, { fontFamily: `${font}SemiBold` }]}>{preview ? t('changePhoto') : t('uploadPhoto')}</Text>
        </TouchableOpacity>
        {error && <Text style={[styles.error, { fontFamily: `${font}Regular` }]}>{error}</Text>}
      </ScrollView>
      <View style={styles.footer}>
        {preview && (
          <TouchableOpacity style={styles.continueButton} onPress={() => void finish(false)} disabled={busy}>
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={[styles.continueText, { fontFamily: `${font}Bold` }]}>{t('useThisPhoto')}</Text>}
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.skipButton} onPress={() => void finish(true)} disabled={busy}>
          <Text style={[styles.skipText, { fontFamily: `${font}SemiBold` }]}>{t('roleSkip')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl, flexGrow: 1 },
  logo: { width: 112, height: 74, marginBottom: spacing.md },
  title: { ...typography.title, color: colors.brown, textAlign: 'center' },
  subtitle: { ...typography.caption, color: colors.brownMuted, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.xl },
  avatar: { width: 150, height: 150, borderRadius: 75, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: colors.borderLight },
  avatarImage: { width: 150, height: 150, borderRadius: 75 },
  changeButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, marginTop: spacing.md },
  changeText: { color: colors.primary, fontSize: 14 },
  error: { color: colors.error, textAlign: 'center', fontSize: 12, marginTop: spacing.sm },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  continueButton: { minHeight: 50, backgroundColor: colors.primary, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  continueText: { color: colors.white, fontSize: 15 },
  skipButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  skipText: { color: colors.brownMuted, fontSize: 14 },
});

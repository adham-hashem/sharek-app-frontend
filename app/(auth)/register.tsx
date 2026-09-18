import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image, Modal } from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { router } from 'expo-router';
import { Mail, Lock, User, Moon, Church, Globe, Check, Scroll, Phone } from 'lucide-react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { UserReligion } from '@/lib/supabase';
import { COUNTRIES } from '@/lib/countries';

const religionOptions: Array<{
  value: UserReligion;
  icon: React.ReactNode;
  labelKey: string;
  color: string;
  bg: string;
}> = [
  { value: 'muslim', icon: <Moon size={22} color={colors.green} />, labelKey: 'religionMuslim', color: colors.green, bg: colors.greenBg },
  { value: 'christian', icon: <Church size={22} color={colors.primary} />, labelKey: 'religionChristian', color: colors.primary, bg: colors.surfaceAlt },
  { value: 'jewish', icon: <Scroll size={22} color={colors.goldenDark} />, labelKey: 'religionJewish', color: colors.goldenDark, bg: colors.warningBg },
  { value: 'other', icon: <Globe size={22} color={colors.brownLight} />, labelKey: 'religionOther', color: colors.brownLight, bg: colors.surfaceMuted },
];

const DIAL_CODES: Record<string, { dial: string; placeholder: string }> = {
  AE: { dial: '+971', placeholder: '50 123 4567' },
  SA: { dial: '+966', placeholder: '50 123 4567' },
  EG: { dial: '+20', placeholder: '10 1234 5678' },
  KW: { dial: '+965', placeholder: '500 12345' },
  QA: { dial: '+974', placeholder: '3312 3456' },
  BH: { dial: '+973', placeholder: '3600 1234' },
  OM: { dial: '+968', placeholder: '9123 4567' },
  JO: { dial: '+962', placeholder: '7 9012 3456' },
  IQ: { dial: '+964', placeholder: '770 123 4567' },
  LB: { dial: '+961', placeholder: '70 123 456' },
  SY: { dial: '+963', placeholder: '944 123 456' },
  YE: { dial: '+967', placeholder: '777 123 456' },
  PS: { dial: '+970', placeholder: '59 123 4567' },
  SD: { dial: '+249', placeholder: '91 123 4567' },
  LY: { dial: '+218', placeholder: '91 123 4567' },
  TN: { dial: '+216', placeholder: '20 123 456' },
  DZ: { dial: '+213', placeholder: '551 23 45 67' },
  MA: { dial: '+212', placeholder: '612 345 678' },
  MR: { dial: '+222', placeholder: '22 12 34 56' },
  SO: { dial: '+252', placeholder: '61 1234567' },
  DJ: { dial: '+253', placeholder: '77 12 34 56' },
  KM: { dial: '+269', placeholder: '321 23 45' },
};

const phoneCountries = COUNTRIES
  .filter((country) => DIAL_CODES[country.code])
  .map((country) => ({ ...country, ...DIAL_CODES[country.code] }));

export default function RegisterScreen() {
  const { signUp, t, language } = useAuth();
  const [fullName, setFullName] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(phoneCountries.find((country) => country.code === 'AE') ?? phoneCountries[0]);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [religion, setReligion] = useState<UserReligion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [countryModal, setCountryModal] = useState(false);

    const submit = async () => {
    setError(null);
    if (!fullName.trim()) return setError(t('fullNameRequired'));
    if (!phone.trim()) return setError(t('phoneRequired'));
    const localPhone = phone.replace(/[^\d]/g, '').replace(/^0+/, '');
    const fullPhone = `${selectedCountry.dial}${localPhone}`;
    if (!/^\+[0-9]{8,15}$/.test(fullPhone)) return setError(t('invalidPhone'));
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email)) return setError(t('invalidEmail'));
    if (password.length < 6) return setError(t('passwordRequired'));
    if (!religion) return setError(t('religionRequired'));

    setBusy(true);
    const res = await signUp(fullPhone, email.trim(), password, fullName.trim(), religion);
    setBusy(false);
    if (res.error) {
      setError(t(res.error));
      return;
    }
    
    if (!res.session) {
      setError(language === 'ar'
        ? 'تم إنشاء الحساب. يرجى تأكيد رقم الهاتف باستخدام رسالة التحقق قبل تسجيل الدخول.'
        : 'Account created. Please confirm your phone number with the verification message before signing in.');
      setTimeout(() => {
        router.replace('/(auth)/login');
      }, 3000);
      return;
    }

    router.replace('/(auth)/role');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="" style={{ paddingHorizontal: 0, paddingTop: spacing.md, paddingBottom: spacing.sm }} />

        <Image source={require('../../assets/images/image copy.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>{t('register')}</Text>
        <Text style={styles.sub}>{t('registerSub')}</Text>

        <View style={styles.form}>
          <View style={styles.inputWrap}>
            <User color={colors.brownMuted} size={20} />
            <TextInput
              style={styles.input}
              placeholder={t('fullName')}
              value={fullName}
              onChangeText={setFullName}
              placeholderTextColor={colors.brownMuted}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputWrap}>
            <Phone color={colors.brownMuted} size={20} />
            <TouchableOpacity style={styles.countryCodeBtn} onPress={() => setCountryModal(true)} activeOpacity={0.8}>
              <Text style={styles.countryCodeText}>
                {selectedCountry.flag} {selectedCountry.dial}
              </Text>
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder={selectedCountry.placeholder}
              value={phone}
              onChangeText={setPhone}
              placeholderTextColor={colors.brownMuted}
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <Text style={styles.helperText}>
            {language === 'ar'
              ? `اختر كود الدولة ثم اكتب باقي الرقم فقط. مثال: ${selectedCountry.dial} ${selectedCountry.placeholder}`
              : `Choose the country code, then enter the rest of the number. Example: ${selectedCountry.dial} ${selectedCountry.placeholder}`}
          </Text>

          <View style={styles.inputWrap}>
            <Mail color={colors.brownMuted} size={20} />
            <TextInput
              style={styles.input}
              placeholder={language === 'ar' ? 'البريد الإلكتروني اختياري لاستعادة كلمة المرور' : 'Email optional for password recovery'}
              value={email}
              onChangeText={setEmail}
              placeholderTextColor={colors.brownMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <Text style={styles.helperText}>
            {language === 'ar'
              ? 'سنستخدم البريد الإلكتروني فقط لاستعادة كلمة المرور وإرسال رابط آمن عند الحاجة.'
              : 'Email is used only for password recovery and secure reset links when needed.'}
          </Text>

          <View style={styles.inputWrap}>
            <Lock color={colors.brownMuted} size={20} />
            <TextInput
              style={styles.input}
              placeholder={t('password')}
              value={password}
              onChangeText={setPassword}
              placeholderTextColor={colors.brownMuted}
              secureTextEntry
            />
          </View>

          <View style={styles.religionSection}>
            <Text style={styles.religionLabel}>{t('selectReligion')}</Text>
            <Text style={styles.religionSub}>{t('selectReligionSub')}</Text>
            <View style={styles.religionGrid}>
              {religionOptions.map(({ value, icon, labelKey, color, bg }) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.religionCard,
                    religion === value && { borderColor: color, borderWidth: 2.5 },
                  ]}
                  onPress={() => setReligion(value)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.religionIcon, { backgroundColor: bg }]}>
                    {icon}
                  </View>
                  <Text style={[styles.religionName, religion === value && { color }]}>
                    {t(labelKey)}
                  </Text>
                  {religion === value && (
                    <View style={[styles.religionCheck, { backgroundColor: color }]}>
                      <Check size={12} color={colors.white} strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.button} onPress={submit} disabled={busy} activeOpacity={0.8}>
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{t('createAccount')}</Text>}
          </TouchableOpacity>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>{t('haveAccount')} </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.switchLink}>{t('login')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal visible={countryModal} transparent animationType="slide" onRequestClose={() => setCountryModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.countryModal}>
            <Text style={styles.modalTitle}>
              {language === 'ar' ? 'اختر كود الدولة' : 'Choose country code'}
            </Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {phoneCountries.map((country) => (
                <TouchableOpacity
                  key={country.code}
                  style={styles.countryRow}
                  onPress={() => {
                    setSelectedCountry(country);
                    setCountryModal(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.countryName}>
                    {country.flag} {language === 'ar' ? country.nameAr : country.nameEn}
                  </Text>
                  <Text style={styles.countryDial}>{country.dial}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setCountryModal(false)}>
              <Text style={styles.modalCloseText}>{t('back')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl },

  logo: { width: 140, height: 140, alignSelf: 'center', marginBottom: spacing.md },
  title: { ...typography.title, color: colors.brown, textAlign: 'center' },
  sub: { ...typography.caption, color: colors.brownMuted, textAlign: 'center', marginBottom: spacing.xl, marginTop: spacing.xs },
  form: { gap: spacing.md },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surfaceAlt, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  input: { ...typography.body, flex: 1, color: colors.brown, padding: 0 },
  helperText: { ...typography.small, color: colors.brownMuted, marginTop: -spacing.sm, lineHeight: 20 },
  countryCodeBtn: {
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  countryCodeText: { ...typography.small, color: colors.brown },

  religionSection: {
    marginTop: spacing.xs,
  },
  religionLabel: {
    ...typography.bodyBold, color: colors.brown, marginBottom: 2,
  },
  religionSub: {
    ...typography.small, color: colors.brownMuted, marginBottom: spacing.sm,
  },
  religionGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
  },
  religionCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    position: 'relative',
  },
  religionIcon: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.xs,
  },
  religionName: {
    ...typography.bodyBold, color: colors.brown, textAlign: 'center',
  },
  religionCheck: {
    position: 'absolute', top: 8, right: 8,
    width: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },

  errorBox: { backgroundColor: colors.errorBg, borderRadius: radius.sm, padding: spacing.sm },
  errorText: { ...typography.caption, color: colors.error, textAlign: 'center' },
  button: {
    backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: radius.md,
    alignItems: 'center', marginTop: spacing.sm,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  buttonText: { ...typography.bodyBold, color: colors.white },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: spacing.md },
  switchText: { ...typography.body, color: colors.brownMuted },
  switchLink: { ...typography.bodyBold, color: colors.primary },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  countryModal: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
  },
  modalTitle: { ...typography.heading, color: colors.brown, textAlign: 'center', marginBottom: spacing.md },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  countryName: { ...typography.body, color: colors.brown, flex: 1 },
  countryDial: { ...typography.bodyBold, color: colors.primary },
  modalCloseBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  modalCloseText: { ...typography.bodyBold, color: colors.white },
});

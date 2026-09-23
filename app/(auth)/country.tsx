import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, Search, X } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { COUNTRIES, CountryInfo, getCountryByCode } from '@/lib/countries';
import { colors, radius, spacing } from '@/lib/theme';

const dialingCodes: Record<string, string> = {
  SA: '+966', AE: '+971', EG: '+20', KW: '+965', QA: '+974', BH: '+973',
  OM: '+968', JO: '+962', IQ: '+964', LB: '+961', SY: '+963', YE: '+967',
  PS: '+970', SD: '+249', LY: '+218', TN: '+216', DZ: '+213', MA: '+212',
  MR: '+222', SO: '+252', DJ: '+253', KM: '+269',
  GB: '+44', US: '+1', CA: '+1', AU: '+61',
};

export default function CountryScreen() {
  const { t, language, profile, updateCountry } = useAuth();
  const rtl = language === 'ar';
  const font = rtl ? 'Cairo-' : 'Inter-';
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(profile?.country ?? null);
  const [busy, setBusy] = useState(false);
  const selectedCountry = selected ? getCountryByCode(selected) : null;

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return COUNTRIES;
    return COUNTRIES.filter(country =>
      (rtl ? country.nameAr : country.nameEn).toLocaleLowerCase().includes(query)
    );
  }, [search, rtl]);

  const confirm = async () => {
    if (!selectedCountry || busy) return;
    setBusy(true);
    const result = await updateCountry(selectedCountry.code, selectedCountry.currency);
    setBusy(false);
    if (result.error) {
      alert(t(result.error));
      return;
    }
    router.replace('/');
  };

  const renderCountry = ({ item }: { item: CountryInfo }) => {
    const active = item.code === selected;
    return (
      <TouchableOpacity
        style={[styles.row, { flexDirection: rtl ? 'row-reverse' : 'row' }, active && styles.rowSelected]}
        onPress={() => { setSelected(item.code); Keyboard.dismiss(); }}
        activeOpacity={0.75}
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
      >
        <Text style={styles.flag}>{item.flag}</Text>
        <Text numberOfLines={1} style={[styles.countryName, { fontFamily: `${font}Medium`, textAlign: rtl ? 'right' : 'left' }, active && styles.countryNameSelected]}>
          {rtl ? item.nameAr : item.nameEn}
        </Text>
        <Text style={styles.dialCode}>{dialingCodes[item.code]}</Text>
        {active && <Check size={17} strokeWidth={2.2} color={colors.primary} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={[styles.topBar, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
          accessibilityRole="button"
          accessibilityLabel={rtl ? 'رجوع' : 'Back'}
        >
          {rtl ? <ChevronRight size={21} color={colors.brown} /> : <ChevronLeft size={21} color={colors.brown} />}
        </TouchableOpacity>
      </View>

      <Image source={require('../../assets/images/image copy.png')} style={styles.logo} resizeMode="contain" />
      <Text style={[styles.title, { fontFamily: `${font}Bold` }]}>{t('selectCountry')}</Text>
      <Text style={[styles.subtitle, { fontFamily: `${font}Regular` }]}>{t('selectCountrySub')}</Text>

      <View style={[styles.searchWrap, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
        <Search size={18} color={colors.brownMuted} />
        <TextInput
          style={[styles.searchInput, { fontFamily: `${font}Regular`, textAlign: rtl ? 'right' : 'left' }]}
          placeholder={t('searchCountry')}
          placeholderTextColor={colors.brownMuted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel={t('searchCountry')}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8} accessibilityRole="button" accessibilityLabel={rtl ? 'مسح البحث' : 'Clear search'}>
            <X size={17} color={colors.brownMuted} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.code}
        renderItem={renderCountry}
        keyboardShouldPersistTaps="handled"
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<Text style={[styles.empty, { fontFamily: `${font}Regular` }]}>{t('noResults')}</Text>}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmButton, !selectedCountry && styles.confirmDisabled]}
          onPress={confirm}
          disabled={!selectedCountry || busy}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityState={{ disabled: !selectedCountry || busy }}
        >
          {busy ? <ActivityIndicator color={colors.white} /> : <Text style={[styles.confirmText, { fontFamily: `${font}Bold` }]}>{t('confirm')}</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  topBar: { height: 40, paddingHorizontal: spacing.md, alignItems: 'center' },
  backButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  logo: { width: 104, height: 68, alignSelf: 'center', marginTop: 2 },
  title: { fontSize: 21, lineHeight: 32, color: colors.brown, textAlign: 'center', marginTop: 2 },
  subtitle: { fontSize: 12, lineHeight: 20, color: colors.brownMuted, textAlign: 'center', marginBottom: spacing.md, paddingHorizontal: spacing.lg },
  searchWrap: { height: 44, alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.md, marginBottom: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  searchInput: { flex: 1, fontSize: 13, color: colors.brown, paddingVertical: 0 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, flexGrow: 1 },
  row: { minHeight: 56, alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  rowSelected: { backgroundColor: colors.surfaceAlt },
  flag: { fontSize: 25, lineHeight: 32 },
  countryName: { flex: 1, fontSize: 14, color: colors.brown },
  countryNameSelected: { color: colors.primaryDark },
  dialCode: { fontSize: 12, color: colors.brownMuted, minWidth: 38, textAlign: 'center', writingDirection: 'ltr' },
  separator: { height: 1, marginHorizontal: spacing.sm, backgroundColor: colors.borderLight },
  empty: { textAlign: 'center', color: colors.brownMuted, marginTop: spacing.lg },
  footer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: colors.white },
  confirmButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.primary },
  confirmDisabled: { opacity: 0.45 },
  confirmText: { fontSize: 15, color: colors.white },
});

import React, { useState, useMemo, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, TextInput, Image, ActivityIndicator, Keyboard } from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { router } from 'expo-router';
import { COUNTRIES, CountryInfo, getCountryByCode } from '@/lib/countries';
import { supabase } from '@/lib/supabase';
import { Search, Check, X } from 'lucide-react-native';
import { ScreenHeader } from '@/components/ScreenHeader';

export default function CountryScreen() {
  const { t, language, profile, rtl } = useAuth();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(profile?.country ?? null);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return COUNTRIES.filter(c =>
      c.nameAr.includes(q) ||
      c.nameEn.toLowerCase().includes(q) ||
      c.currency.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [search]);

  const selectedCountry = selected ? getCountryByCode(selected) : null;

  const pickCountry = (code: string) => {
    setSelected(code);
    setSearch('');
    Keyboard.dismiss();
    setFocused(false);
  };

  const confirm = async () => {
    if (!selected) return;
    setBusy(true);
    const country = getCountryByCode(selected);
    if (country) {
      await supabase
        .from('profiles')
        .update({ country: country.code, currency: country.currency })
        .eq('id', profile?.id ?? '');
    }
    setBusy(false);
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="" style={{ paddingHorizontal: 0, paddingTop: spacing.md, paddingBottom: spacing.sm }} />

        <Image source={require('../../assets/images/image copy.png')} style={styles.logo} resizeMode="contain" />

        <Text style={[typography.title, { color: colors.brown, textAlign: 'center', fontFamily: `${font}Bold` }]}>
          {t('selectCountry')}
        </Text>
        <Text style={[typography.caption, { color: colors.brownMuted, textAlign: 'center', marginBottom: spacing.lg, marginTop: spacing.xs, fontFamily: `${font}Regular` }]}>
          {t('selectCountrySub')}
        </Text>

        <View style={styles.searchContainer}>
          <View style={[styles.searchWrap, focused && styles.searchWrapFocused]}>
            <Search size={20} color={colors.brownMuted} />
            <TextInput
              ref={inputRef}
              style={[styles.searchInput, { fontFamily: `${font}Regular` }]}
              placeholder={t('searchCountry')}
              value={search}
              onChangeText={setSearch}
              placeholderTextColor={colors.brownMuted}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => { setSearch(''); inputRef.current?.focus(); }} hitSlop={8}>
                <X size={18} color={colors.brownMuted} />
              </TouchableOpacity>
            )}
          </View>

          {search.trim().length > 0 && (
            <View style={styles.dropdown}>
              <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                {filtered.length === 0 ? (
                  <Text style={[typography.body, { color: colors.brownMuted, textAlign: 'center', paddingVertical: spacing.md, fontFamily: `${font}Regular` }]}>
                    {t('noResults')}
                  </Text>
                ) : (
                  filtered.map((c) => (
                    <TouchableOpacity
                      key={c.code}
                      style={[styles.dropdownItem, selected === c.code && styles.dropdownItemActive]}
                      onPress={() => pickCountry(c.code)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.flag}>{c.flag}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.body, { color: colors.brown, fontFamily: `${font}SemiBold` }]}>
                          {language === 'ar' ? c.nameAr : c.nameEn}
                        </Text>
                        <Text style={[typography.micro, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
                          {c.code} · {c.currency}
                        </Text>
                      </View>
                      {selected === c.code && (
                        <Check size={18} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          )}
        </View>

        {selectedCountry && search.trim().length === 0 && (
          <View style={styles.selectedChip}>
            <Text style={styles.flag}>{selectedCountry.flag}</Text>
            <Text style={[typography.body, { color: colors.brown, fontFamily: `${font}SemiBold` }]}>
              {language === 'ar' ? selectedCountry.nameAr : selectedCountry.nameEn}
            </Text>
            <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
              {selectedCountry.currency}
            </Text>
            <TouchableOpacity onPress={() => { setSelected(null); inputRef.current?.focus(); }} hitSlop={8}>
              <X size={16} color={colors.brownMuted} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmBtn, !selected && { opacity: 0.5 }]}
          onPress={confirm}
          disabled={!selected || busy}
          activeOpacity={0.8}
        >
          {busy ? <ActivityIndicator color={colors.white} /> : (
            <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>
              {t('confirm')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  logo: { width: 120, height: 120, alignSelf: 'center', marginBottom: spacing.md },
  searchContainer: { position: 'relative', marginBottom: spacing.md },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surfaceAlt, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  searchWrapFocused: {
    borderColor: colors.primary,
  },
  searchInput: { ...typography.body, flex: 1, color: colors.brown, padding: 0 },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
    maxHeight: 280,
    shadowColor: colors.shadowStrong, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 8,
  },
  dropdownScroll: { maxHeight: 280 },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  dropdownItemActive: {
    backgroundColor: colors.surfaceAlt,
  },
  flag: { fontSize: 22 },
  selectedChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.pill,
    borderWidth: 1.5, borderColor: colors.primary,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
  },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  confirmBtn: {
    backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: radius.md,
    alignItems: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
});

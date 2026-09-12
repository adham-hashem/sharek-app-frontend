import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';
import * as Location from 'expo-location';
import { Platform, Linking } from 'react-native';
import {
  ChevronLeft, Bell, Volume2, Vibrate, MapPin, Shield,
  LogOut, Trash2, Globe, Check,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { AppLanguage } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    t, language, setLanguage, settings, updateSettings,
    signOut, deleteAccount, rtl,
  } = useAuth();
  const [busy, setBusy] = useState(false);
  const [langBusy, setLangBusy] = useState(false);
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';

  const toggleSetting = useCallback(async (
    key: 'notifications_enabled' | 'request_sound_enabled' | 'vibration_enabled' | 'location_enabled',
    value: boolean,
  ) => {
    await updateSettings({ [key]: value });
  }, [updateSettings]);

  const toggleLang = async () => {
    setLangBusy(true);
    const newLang = language === 'ar' ? 'en' : 'ar';
    await setLanguage(newLang);
    setLangBusy(false);
  };

  const openLocationSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else if (Platform.OS === 'android') {
      Linking.openSettings();
    } else {
      Alert.alert(t('locationPermissionSetting'));
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      t('deleteAccount'),
      t('deleteAccountConfirm'),
      [
        { text: t('back'), style: 'cancel' },
        {
          text: t('deleteAccount'),
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            const { error } = await deleteAccount();
            setBusy(false);
            if (error) {
              Alert.alert(t('errorGeneric'));
            } else {
              Alert.alert(t('accountDeleted'));
              router.replace('/(auth)/language');
            }
          },
        },
      ]
    );
  };

  const SettingRow = ({
    icon, label, value, onToggle, color,
  }: {
    icon: React.ReactNode;
    label: string;
    value: boolean;
    onToggle: (v: boolean) => void;
    color: string;
  }) => (
    <View style={styles.settingRow}>
      <View style={[styles.settingIcon, { backgroundColor: color + '20' }]}>
        {icon}
      </View>
      <Text style={[typography.body, { color: colors.brown, flex: 1, fontFamily: ${""}Regular }]}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={value ? colors.white : colors.white}
      />
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl, paddingTop: insets.top }}>
      <ScreenHeader title={t('settings')} onBack={() => router.replace('/(tabs)/menu')} />

      <View style={styles.section}>
        <Text style={[typography.bodyBold, { color: colors.brown, marginBottom: spacing.sm, fontFamily: ${""}Bold }]}>
          {t('language2')}
        </Text>
        <TouchableOpacity style={styles.langRow} onPress={toggleLang} disabled={langBusy} activeOpacity={0.7}>
          <Globe size={20} color={colors.primary} />
          <Text style={[typography.body, { color: colors.brown, flex: 1, fontFamily: ${""}Regular }]}>
            {language === 'ar' ? t('arabic') : t('english')}
          </Text>
          {langBusy ? <ActivityIndicator size="small" color={colors.primary} /> : (
            <Text style={[typography.small, { color: colors.brownMuted, fontFamily: ${""}SemiBold }]}>
              {language === 'ar' ? 'EN' : 'AR'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={[typography.bodyBold, { color: colors.brown, marginBottom: spacing.sm, fontFamily: ${""}Bold }]}>
          {t('notifications')}
        </Text>
        <SettingRow
          icon={<Bell size={20} color={colors.primary} />}
          label={t('notifications')}
          value={settings?.notifications_enabled ?? true}
          onToggle={(v) => toggleSetting('notifications_enabled', v)}
          color={colors.primary}
        />
        <SettingRow
          icon={<Volume2 size={20} color={colors.goldenDark} />}
          label={t('requestSound')}
          value={settings?.request_sound_enabled ?? true}
          onToggle={(v) => toggleSetting('request_sound_enabled', v)}
          color={colors.goldenDark}
        />
        <SettingRow
          icon={<Vibrate size={20} color={colors.coral} />}
          label={t('vibration')}
          value={settings?.vibration_enabled ?? true}
          onToggle={(v) => toggleSetting('vibration_enabled', v)}
          color={colors.coral}
        />
        <SettingRow
          icon={<MapPin size={20} color={colors.green} />}
          label={t('locationPermissionSetting')}
          value={settings?.location_enabled ?? true}
          onToggle={(v) => toggleSetting('location_enabled', v)}
          color={colors.green}
        />
        <TouchableOpacity style={styles.locationSystemBtn} onPress={openLocationSettings} activeOpacity={0.7}>
          <Text style={[typography.small, { color: colors.primary, fontFamily: ${""}SemiBold }]}>
            {t('locationPermission')} ?
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.privacyRow} onPress={() => router.push('/privacy' as never)} activeOpacity={0.7}>
          <Shield size={20} color={colors.brownMuted} />
          <Text style={[typography.body, { color: colors.brown, flex: 1, fontFamily: ${""}Regular }]}>
            {t('privacy')}
          </Text>
          <ChevronLeft size={20} color={colors.brownMuted} style={{ transform: rtl ? [{ scaleX: -1 }] : [] }} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOutRow} onPress={() => Alert.alert(
        t('signOut'),
        t('signOut') + '?',
        [
          { text: t('back'), style: 'cancel' },
          { text: t('signOut'), style: 'destructive', onPress: () => signOut() },
        ]
      )} activeOpacity={0.7}>
        <LogOut size={20} color={colors.error} />
        <Text style={[typography.bodyBold, { color: colors.error, fontFamily: ${""}Bold }]}>
          {t('signOut')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteRow} onPress={confirmDelete} disabled={busy} activeOpacity={0.7}>
        {busy ? <ActivityIndicator color={colors.error} size={20} /> : <Trash2 size={20} color={colors.error} />}
        <Text style={[typography.bodyBold, { color: colors.error, fontFamily: ${""}Bold }]}>
          {t('deleteAccount')}
        </Text>
      </TouchableOpacity>
      <Text style={[typography.small, { color: colors.brownMuted, textAlign: 'center', marginTop: spacing.xs, fontFamily: ${""}Regular }]}>
        {t('deleteAccountWarning')}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  section: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    marginHorizontal: spacing.lg, marginBottom: spacing.md, borderWidth: 1.5, borderColor: colors.border,
  },
  langRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  settingIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  locationSystemBtn: { paddingVertical: spacing.xs, alignItems: 'flex-end' },
  privacyRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  signOutRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.errorBg, borderRadius: radius.md, paddingVertical: spacing.md,
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
  },
  deleteRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.white, borderRadius: radius.md, paddingVertical: spacing.md,
    marginHorizontal: spacing.lg, borderWidth: 1.5, borderColor: colors.error,
  },
});

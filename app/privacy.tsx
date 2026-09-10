import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MapPin, ShieldCheck } from 'lucide-react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuth } from '@/lib/auth';
import { colors, radius, spacing, typography } from '@/lib/theme';

export default function PrivacyScreen() {
  const { t, language } = useAuth();
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title={t('privacy')} />
      <View style={styles.card}>
        <ShieldCheck size={32} color={colors.green} />
        <Text style={[typography.body, styles.text, { fontFamily: `${font}Regular` }]}>{t('privacyText')}</Text>
      </View>
      <View style={styles.card}>
        <MapPin size={32} color={colors.primary} />
        <Text style={[typography.body, styles.text, { fontFamily: `${font}Regular` }]}>{t('privacyLocationText')}</Text>
      </View>
      <View style={styles.card}>
        <Text style={[typography.body, styles.text, { fontFamily: `${font}Regular` }]}>{t('privacyContact')}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.lg, gap: spacing.md },
  text: { color: colors.brown, lineHeight: 26 },
});

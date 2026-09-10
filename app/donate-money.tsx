import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { DollarSign, Clock } from 'lucide-react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';

export default function DonateMoneyScreen() {
  const { language, t } = useAuth();
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('donatingMoney')} />

      <View style={styles.card}>
        <View style={styles.icon}>
          <DollarSign size={28} color={colors.goldenDark} />
        </View>
        <Text style={[typography.title, styles.title, { fontFamily: `${font}Bold` }]}>
          {language === 'ar' ? 'التبرعات المالية متوقفة مؤقتًا' : 'Financial donations are temporarily disabled'}
        </Text>
        <Text style={[typography.body, styles.body, { fontFamily: `${font}Regular` }]}>
          {language === 'ar'
            ? 'لا توجد أي معاملات دفع داخل التطبيق حاليًا. مشاركة الطعام ونشر الوجبات المتاحة ما زالت تعمل كالمعتاد.'
            : 'There are no payment transactions in the app right now. Food sharing and timed food offers continue to work normally.'}
        </Text>
        <View style={styles.note}>
          <Clock size={18} color={colors.brownMuted} />
          <Text style={[typography.small, styles.noteText, { fontFamily: `${font}Regular` }]}>
            {language === 'ar'
              ? 'يمكن إعادة تفعيل هذا المسار لاحقًا بعد تجهيز بوابة الدفع والتصاريح المطلوبة.'
              : 'This flow can be re-enabled later after the payment gateway and required approvals are ready.'}
          </Text>
        </View>
        <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(tabs)')} activeOpacity={0.8}>
          <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>{t('confirm')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    padding: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.warningBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { color: colors.brown, textAlign: 'center', marginBottom: spacing.sm },
  body: { color: colors.brownMuted, textAlign: 'center', marginBottom: spacing.lg },
  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.xl,
  },
  noteText: { color: colors.brownMuted, flex: 1 },
  btn: {
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.golden,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
});

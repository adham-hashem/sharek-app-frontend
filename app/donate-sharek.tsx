import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, Clock, Heart } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';

export default function DonateSharekScreen() {
  const { t, language, rtl } = useAuth();
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.brown} style={{ transform: rtl ? [{ scaleX: -1 }] : [] }} />
        </TouchableOpacity>
        <Text style={[typography.heading, { color: colors.brown, fontFamily: `${font}Bold` }]}>
          {t('donateToSharek')}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.card}>
        <View style={styles.icon}>
          <Heart size={30} color={colors.coral} />
        </View>
        <Text style={[typography.title, styles.title, { fontFamily: `${font}Bold` }]}>
          {language === 'ar' ? 'دعم SHAREk المالي متوقف مؤقتًا' : 'SHARek financial support is temporarily disabled'}
        </Text>
        <Text style={[typography.body, styles.body, { fontFamily: `${font}Regular` }]}>
          {language === 'ar'
            ? 'لن يتم إنشاء أي عملية دفع أو تسجيل أي تبرع مالي الآن. التطبيق سيستمر في دعم مشاركة الطعام، الحجز، الخريطة، الصلاحية، الشات، والتتبع المباشر.'
            : 'No payment operation or financial donation record is created now. Food sharing, booking, map discovery, expiry, chat, and live tracking remain active.'}
        </Text>
        <View style={styles.note}>
          <Clock size={18} color={colors.brownMuted} />
          <Text style={[typography.small, styles.noteText, { fontFamily: `${font}Regular` }]}>
            {language === 'ar'
              ? 'تم ترك هذا المسار كميزة مستقبلية يمكن إعادة تفعيلها بعد اختيار بوابة الدفع والانتهاء من المتطلبات القانونية.'
              : 'This path is kept as a future feature that can be re-enabled after choosing a gateway and completing legal requirements.'}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  backBtn: { padding: spacing.xs },
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
    backgroundColor: colors.errorBg,
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

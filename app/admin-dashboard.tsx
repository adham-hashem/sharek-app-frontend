import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import {
  BadgeCheck, Building2, ChevronLeft, DollarSign, ShieldCheck, Star,
  TrendingUp, Users, Settings,
} from 'lucide-react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuth } from '@/lib/auth';
import { colors, radius, spacing, typography } from '@/lib/theme';

type AdminCard = {
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  bulletsAr: string[];
  bulletsEn: string[];
  route: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
};

export default function AdminDashboardScreen() {
  const { profile, language } = useAuth();
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';
  const rtl = language === 'ar';
  const isAdmin = profile?.is_admin === true;

  const cards: AdminCard[] = [
    {
      titleAr: 'طلبات الأدوار',
      titleEn: 'Role Requests',
      descAr: 'مراجعة الحسابات التي طلبت دور جمعية أو مؤسسة أو مطعم أو فندق.',
      descEn: 'Review accounts requesting charity, organization, restaurant, or hotel roles.',
      bulletsAr: ['عرض اسم وإيميل صاحب الطلب', 'معرفة الدور والوضع المطلوب', 'قبول الطلب وتحديث profiles تلقائيًا', 'رفض الطلب مع ملاحظات اختيارية'],
      bulletsEn: ['View requester name and email', 'See requested role and mode', 'Approve and update profiles automatically', 'Reject with optional admin notes'],
      route: '/admin-role-requests',
      icon: <Building2 size={24} color={colors.primary} />,
      color: colors.primary,
      bg: colors.surfaceAlt,
    },
    {
      titleAr: 'إدارة أسعار الوجبات',
      titleEn: 'Meal Pricing',
      descAr: 'التحكم في أنواع الوجبات والسعر العالمي بالدولار وسجل تغييرات الأسعار.',
      descEn: 'Manage meal types, global USD prices, and the price-change audit log.',
      bulletsAr: ['تعديل اسم ووصف نوع الوجبة', 'تعديل السعر الأساسي بالدولار', 'تفعيل أو تعطيل نوع وجبة', 'مراجعة سجل تغييرات الأسعار'],
      bulletsEn: ['Edit meal type name and description', 'Update the base USD price', 'Enable or disable a meal type', 'Review price-change history'],
      route: '/admin',
      icon: <DollarSign size={24} color={colors.goldenDark} />,
      color: colors.goldenDark,
      bg: colors.warningBg,
    },
    {
      titleAr: 'إدارة التوثيق',
      titleEn: 'Verification Admin',
      descAr: 'مراجعة طلبات توثيق الحسابات ورسوم التوثيق وإحصائيات الإيرادات.',
      descEn: 'Review verification requests, verification fees, and revenue statistics.',
      bulletsAr: ['قبول طلبات التوثيق', 'رفض أو تعليق طلبات التوثيق مع ملاحظات', 'تعديل رسوم التوثيق حسب الدولة', 'متابعة إحصائيات الطلبات والإيرادات'],
      bulletsEn: ['Approve verification requests', 'Reject or suspend requests with notes', 'Edit country verification fees', 'Monitor request and revenue stats'],
      route: '/admin-verification',
      icon: <BadgeCheck size={24} color="#1DA1F2" />,
      color: '#1DA1F2',
      bg: 'rgba(29, 161, 242, 0.1)',
    },
    {
      titleAr: 'إدارة التقييمات والمراجعات',
      titleEn: 'Ratings & Reviews',
      descAr: 'متابعة جودة التعاملات والتقييمات المسيئة أو غير المناسبة.',
      descEn: 'Monitor interaction quality and inappropriate or flagged reviews.',
      bulletsAr: ['عرض متوسط وعدد التقييمات', 'تمييز التقييمات المسيئة', 'حذف المراجعات غير المناسبة', 'مراجعة شارات ومستويات المساهمين'],
      bulletsEn: ['View rating totals and averages', 'Flag inappropriate reviews', 'Delete unsuitable reviews', 'Review contributor badges and levels'],
      route: '/admin-ratings',
      icon: <Star size={24} color={colors.goldenDark} />,
      color: colors.goldenDark,
      bg: colors.warningBg,
    },
  ];

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={language === 'ar' ? 'لوحة الإدارة' : 'Admin Dashboard'} onBack={() => router.replace('/(tabs)/menu')} />
        <View style={styles.accessDenied}>
          <ShieldCheck size={52} color={colors.brownMuted} />
          <Text style={[typography.heading, { color: colors.brown, marginTop: spacing.md, fontFamily: `${font}Bold` }]}>
            {language === 'ar' ? 'غير مصرح' : 'Access denied'}
          </Text>
          <Text style={[typography.body, { color: colors.brownMuted, textAlign: 'center', marginTop: spacing.xs, fontFamily: `${font}Regular` }]}>
            {language === 'ar' ? 'هذه الصفحة مخصصة لحسابات الإدارة فقط.' : 'This page is available to administrator accounts only.'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={language === 'ar' ? 'لوحة الإدارة' : 'Admin Dashboard'} onBack={() => router.replace('/(tabs)/menu')} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <ShieldCheck size={28} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.heading, { color: colors.brown, fontFamily: `${font}Bold` }]}>
              {language === 'ar' ? 'صلاحيات الإدارة' : 'Admin controls'}
            </Text>
            <Text style={[typography.caption, { color: colors.brownMuted, marginTop: 2, fontFamily: `${font}Regular` }]}>
              {language === 'ar'
                ? 'اختر أداة الإدارة المطلوبة. كل العمليات الحساسة محمية بحساب أدمن من جدول profiles.'
                : 'Choose an admin tool. Sensitive actions are protected by the profiles admin flag.'}
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Settings size={20} color={colors.primary} />
            <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]}>
              {cards.length}
            </Text>
            <Text style={[typography.micro, { color: colors.brownMuted, textAlign: 'center', fontFamily: `${font}Regular` }]}>
              {language === 'ar' ? 'أدوات إدارة' : 'Admin tools'}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Users size={20} color={colors.green} />
            <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]}>
              {language === 'ar' ? 'محمي' : 'Protected'}
            </Text>
            <Text style={[typography.micro, { color: colors.brownMuted, textAlign: 'center', fontFamily: `${font}Regular` }]}>
              {language === 'ar' ? 'حسب is_admin' : 'By is_admin'}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <TrendingUp size={20} color={colors.goldenDark} />
            <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]}>
              {language === 'ar' ? 'مباشر' : 'Live'}
            </Text>
            <Text style={[typography.micro, { color: colors.brownMuted, textAlign: 'center', fontFamily: `${font}Regular` }]}>
              {language === 'ar' ? 'بيانات حقيقية' : 'Real data'}
            </Text>
          </View>
        </View>

        <View style={{ gap: spacing.md }}>
          {cards.map((card) => (
            <TouchableOpacity
              key={card.route}
              style={styles.adminCard}
              activeOpacity={0.82}
              onPress={() => router.push(card.route as never)}
            >
              <View style={[styles.cardIcon, { backgroundColor: card.bg }]}>{card.icon}</View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardTitleRow}>
                  <Text style={[typography.bodyBold, { color: colors.brown, flex: 1, fontFamily: `${font}Bold` }]}>
                    {language === 'ar' ? card.titleAr : card.titleEn}
                  </Text>
                  <ChevronLeft size={22} color={colors.brownMuted} style={{ transform: rtl ? [{ scaleX: -1 }] : [] }} />
                </View>
                <Text style={[typography.caption, { color: colors.brownMuted, marginTop: 2, fontFamily: `${font}Regular` }]}>
                  {language === 'ar' ? card.descAr : card.descEn}
                </Text>
                <View style={styles.bullets}>
                  {(language === 'ar' ? card.bulletsAr : card.bulletsEn).map((bullet) => (
                    <View key={bullet} style={styles.bulletRow}>
                      <View style={[styles.bulletDot, { backgroundColor: card.color }]} />
                      <Text style={[typography.small, { color: colors.brown, flex: 1, fontFamily: `${font}Regular` }]}>
                        {bullet}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  accessDenied: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  hero: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg,
    borderWidth: 1.5, borderColor: colors.border, marginBottom: spacing.md,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 10, elevation: 3,
  },
  heroIcon: {
    width: 58, height: 58, borderRadius: 29, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  summaryCard: {
    flex: 1, alignItems: 'center', gap: 4,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1.5, borderColor: colors.border,
  },
  adminCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg,
    borderWidth: 1.5, borderColor: colors.border,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  cardIcon: {
    width: 52, height: 52, borderRadius: 26,
    justifyContent: 'center', alignItems: 'center',
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bullets: { gap: spacing.xs, marginTop: spacing.sm },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bulletDot: { width: 6, height: 6, borderRadius: 3 },
});

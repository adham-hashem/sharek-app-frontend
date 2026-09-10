import React, { useEffect, useRef } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, Image, Animated, Easing, Platform, Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, radius, typography } from '@/lib/theme';

const { width } = Dimensions.get('window');
const LOGO_W = Math.min(width * 0.72, 300);
const LOGO_H = LOGO_W * (875 / 1313);

export default function WelcomeScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const riseAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(riseAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, riseAnim]);

  const goNext = () => router.replace('/(auth)/language');

  return (
    <View style={styles.container}>
      <View style={styles.blobTop} />
      <View style={styles.blobBottom} />

      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: riseAnim }] },
        ]}
      >
        <Image
          source={require('../../assets/images/image.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.welcomeAr}>أهلاً بك في SHARek</Text>
        <Text style={styles.welcomeEn}>Welcome to SHARek</Text>

        <View style={styles.divider} />

        <Text style={styles.taglineAr}>شارك طعامك... شارك الخير</Text>
        <Text style={styles.taglineEn}>Share Food. Share Goodness.</Text>
      </Animated.View>

      <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={styles.cta}
          onPress={goNext}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>ابدأ الآن · Get Started</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          {Platform.OS === 'web' ? 'Tap to begin · اضغط للبدء' : ''}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  blobTop: {
    position: 'absolute',
    top: -120,
    right: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
  },
  blobBottom: {
    position: 'absolute',
    bottom: -140,
    left: -120,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(249, 178, 51, 0.08)',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  logo: {
    width: LOGO_W,
    height: LOGO_H,
    marginBottom: spacing.xxl,
  },
  welcomeAr: {
    ...typography.heading,
    color: colors.primary,
    fontFamily: 'Cairo-Bold',
    fontSize: 22,
    textAlign: 'center',
  },
  welcomeEn: {
    ...typography.body,
    color: colors.coral,
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 2,
  },
  divider: {
    width: 56,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.golden,
    marginVertical: spacing.lg,
  },
  taglineAr: {
    ...typography.bodyBold,
    color: colors.brown,
    fontFamily: 'Cairo-SemiBold',
    fontSize: 17,
    textAlign: 'center',
  },
  taglineEn: {
    ...typography.caption,
    color: colors.brownMuted,
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.xl,
    alignItems: 'center',
  },
  cta: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  ctaText: {
    color: colors.white,
    fontSize: 16,
    fontFamily: 'Cairo-Bold',
    fontWeight: '700',
  },
  hint: {
    ...typography.small,
    color: colors.brownMuted,
    marginTop: spacing.sm,
    fontFamily: 'Inter-Regular',
  },
});

import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { colors, spacing, typography } from '@/lib/theme';

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  showBack?: boolean;
  style?: ViewStyle;
}

export function ScreenHeader({ title, onBack, rightElement, showBack = true, style }: ScreenHeaderProps) {
  const { language } = useAuth();
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';
  const rtl = language === 'ar';

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <View style={[styles.header, style]}>
      {showBack ? (
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={language === 'ar' ? 'رجوع' : 'Back'}
        >
          <Text style={styles.backArrow}>{rtl ? '›' : '‹'}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.backPlaceholder} />
      )}

      <Text
        style={[typography.heading, { color: colors.brown, flex: 1, fontFamily: `${font}Bold` }]}
        numberOfLines={1}
      >
        {title}
      </Text>

      {rightElement ? rightElement : <View style={styles.backPlaceholder} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: 'transparent',
    zIndex: 20,
    elevation: 20,
  },
  backBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  backArrow: {
    color: colors.brown,
    fontSize: 38,
    lineHeight: 40,
    fontWeight: '800',
    marginTop: -3,
  },
  backPlaceholder: {
    width: 40,
  },
});

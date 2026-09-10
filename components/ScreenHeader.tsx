import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
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
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
          <ChevronLeft
            size={26}
            color={colors.brown}
            style={{ transform: [{ scaleX: rtl ? -1 : 1 }] }}
          />
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
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  backPlaceholder: {
    width: 40,
  },
});

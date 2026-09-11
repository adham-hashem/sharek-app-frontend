import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';
import { colors, spacing, typography } from '@/lib/theme';
import { AppLanguage } from '@/lib/supabase';

interface VerifiedBadgeProps {
  language: AppLanguage;
  size?: number;
  showLabel?: boolean;
}

export function VerifiedBadge({ language, size = 16, showLabel = false }: VerifiedBadgeProps) {
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';
  const label = language === 'ar' ? 'موثق' : 'Verified';

  if (showLabel) {
    return (
      <View style={styles.labelContainer}>
        <CheckCircle2 size={size} color="#1DA1F2" fill="#1DA1F2" />
        <Text style={[typography.micro, { color: '#1DA1F2', fontFamily: `${font}Bold` }]}>
          {label}
        </Text>
      </View>
    );
  }

  return <CheckCircle2 size={size} color="#1DA1F2" fill="#1DA1F2" />;
}

const styles = StyleSheet.create({
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(29, 161, 242, 0.1)',
    borderRadius: 999,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
  },
});

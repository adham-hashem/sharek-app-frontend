import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { AppLanguage, ACHIEVEMENT_BADGES, getAchievementBadge, getNextAchievementBadge } from '@/lib/supabase';

interface AchievementBadgeProps {
  level: number;
  language: AppLanguage;
  t: (key: string) => string;
  size?: number;
}

export function AchievementBadgeDisplay({ level, language, t, size = 18 }: AchievementBadgeProps) {
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';
  const badge = getAchievementBadge(level);

  return (
    <View style={[styles.container, { backgroundColor: badge.bgColor, borderColor: badge.color }]}>
      <Text style={{ fontSize: size }}>{badge.emoji}</Text>
      <Text style={[typography.micro, { color: badge.color, fontFamily: `${font}Bold` }]}>
        {t(badge.labelKey)}
      </Text>
    </View>
  );
}

interface AchievementBadgeMiniProps {
  level: number;
  size?: number;
}

export function AchievementBadgeMini({ level, size = 16 }: AchievementBadgeMiniProps) {
  const badge = getAchievementBadge(level);
  return <Text style={{ fontSize: size }}>{badge.emoji}</Text>;
}

interface AchievementProgressProps {
  level: number;
  completedShares: number;
  language: AppLanguage;
  t: (key: string) => string;
}

export function AchievementProgress({ level, completedShares, language, t }: AchievementProgressProps) {
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';
  const badge = getAchievementBadge(level);
  const nextBadge = getNextAchievementBadge(level);

  if (!nextBadge) {
    return (
      <View style={[styles.maxCard, { backgroundColor: badge.bgColor }]}>
        <Text style={[typography.small, { color: badge.color, fontFamily: `${font}Bold`, textAlign: 'center' }]}>
          {t('maxBadgeReached')} {badge.emoji}
        </Text>
      </View>
    );
  }

  const progress = Math.min(1, (completedShares - badge.minShares) / (nextBadge.minShares - badge.minShares));
  const remaining = nextBadge.minShares - completedShares;

  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressHeader}>
        <View style={styles.currentBadgeSmall}>
          <Text style={{ fontSize: 18 }}>{badge.emoji}</Text>
          <Text style={[typography.micro, { color: badge.color, fontFamily: `${font}SemiBold` }]}>
            {t(badge.labelKey)}
          </Text>
        </View>
        <View style={styles.arrowRow}>
          <Text style={{ fontSize: 14, color: colors.brownMuted }}>→</Text>
        </View>
        <View style={styles.nextBadgeSmall}>
          <Text style={{ fontSize: 18 }}>{nextBadge.emoji}</Text>
          <Text style={[typography.micro, { color: colors.brownMuted, fontFamily: `${font}SemiBold` }]}>
            {t(nextBadge.labelKey)}
          </Text>
        </View>
      </View>

      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${progress * 100}%`, backgroundColor: badge.color }]} />
      </View>

      <Text style={[typography.micro, { color: colors.brownMuted, textAlign: 'center', fontFamily: `${font}Regular` }]}>
        {completedShares} / {nextBadge.minShares} · {remaining} {t('sharesToNextBadge')}
      </Text>
    </View>
  );
}

interface AllBadgesRowProps {
  level: number;
  language: AppLanguage;
  t: (key: string) => string;
}

export function AllBadgesRow({ level, language, t }: AllBadgesRowProps) {
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';
  return (
    <View style={styles.allBadgesRow}>
      {ACHIEVEMENT_BADGES.slice(0, 5).map(b => {
        const unlocked = level >= b.level;
        return (
          <View
            key={b.level}
            style={[
              styles.miniBadge,
              { backgroundColor: unlocked ? b.bgColor : colors.surfaceMuted, borderColor: unlocked ? b.color : colors.border },
            ]}
          >
            <Text style={[styles.miniBadgeEmoji, { opacity: unlocked ? 1 : 0.4 }]}>{b.emoji}</Text>
            <Text
              style={[
                typography.micro,
                { color: unlocked ? b.color : colors.brownMuted, fontFamily: `${font}SemiBold`, textAlign: 'center', opacity: unlocked ? 1 : 0.5 },
              ]}
              numberOfLines={1}
            >
              {t(b.labelKey)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: radius.pill, paddingHorizontal: spacing.xs + 2, paddingVertical: 2,
    borderWidth: 1.5,
  },
  maxCard: {
    paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center',
  },
  progressWrap: {
    gap: spacing.xs,
  },
  progressHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
  },
  currentBadgeSmall: {
    alignItems: 'center', gap: 2,
  },
  arrowRow: {
    alignItems: 'center',
  },
  nextBadgeSmall: {
    alignItems: 'center', gap: 2,
  },
  progressBarBg: {
    height: 10, backgroundColor: colors.surfaceMuted, borderRadius: 5, overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%', borderRadius: 5,
  },
  allBadgesRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs,
  },
  miniBadge: {
    alignItems: 'center', gap: 2, borderRadius: radius.sm,
    paddingHorizontal: spacing.xs, paddingVertical: spacing.xs,
    borderWidth: 1.5, minWidth: 68, flex: 1,
  },
  miniBadgeEmoji: {
    fontSize: 18,
  },
});

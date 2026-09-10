import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { colors, spacing, radius, typography } from '@/lib/theme';
import {
  CONTRIBUTOR_LEVELS, getContributorLevel, getNextContributorLevel, Profile,
} from '@/lib/supabase';

interface Props {
  profile: Profile;
  t: (key: string) => string;
  font: string;
}

export function ContributorBadges({ profile, t, font }: Props) {
  const level = getContributorLevel(profile.contributor_level ?? 0);
  const nextLevel = getNextContributorLevel(profile.contributor_level ?? 0);
  const totalContributions = profile.meals_helped ?? 0;
  const progress = nextLevel
    ? Math.min(1, (totalContributions - level.minContributions) / (nextLevel.minContributions - level.minContributions))
    : 1;
  const remaining = nextLevel ? nextLevel.minContributions - totalContributions : 0;

  return (
    <View style={styles.container}>
      <Text style={[typography.small, styles.sectionTitle, { fontFamily: `${font}SemiBold` }]}>
        {t('badgesTitle')}
      </Text>

      <View style={[styles.currentBadgeCard, { backgroundColor: level.bgColor, borderColor: level.color }]}>
        <Text style={styles.badgeEmoji}>{level.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[typography.bodyBold, { color: level.color, fontFamily: `${font}Bold` }]}>
            {t(level.labelKey)}
          </Text>
          <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
            {t('totalContributions')}: {totalContributions}
          </Text>
        </View>
      </View>

      {nextLevel ? (
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={[typography.small, { color: colors.brown, fontFamily: `${font}SemiBold` }]}>
              {t('progressToNext')}
            </Text>
            <Text style={[typography.small, { color: level.color, fontFamily: `${font}Bold` }]}>
              {nextLevel.emoji} {t(nextLevel.labelKey)}
            </Text>
          </View>

          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress * 100}%`, backgroundColor: level.color }]} />
          </View>

          <Text style={[typography.micro, { color: colors.brownMuted, fontFamily: `${font}Regular`, textAlign: 'center' }]}>
            {totalContributions} / {nextLevel.minContributions} · {remaining} {t('contributionsToNext')}
          </Text>
        </View>
      ) : (
        <View style={[styles.maxLevelCard, { backgroundColor: level.bgColor }]}>
          <Text style={[typography.small, { color: level.color, fontFamily: `${font}Bold`, textAlign: 'center' }]}>
            {t('maxLevel')} 👑
          </Text>
        </View>
      )}

      <View style={styles.statsRow}>
        <View style={styles.statCell}>
          <Text style={[typography.huge, { fontSize: 22, color: colors.brown, fontFamily: `${font}ExtraBold` }]}>
            {totalContributions}
          </Text>
          <Text style={[typography.micro, { color: colors.brownMuted, fontFamily: `${font}Regular`, textAlign: 'center' }]}>
            {t('totalContributions')}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCell}>
          <Text style={[typography.huge, { fontSize: 22, color: colors.brown, fontFamily: `${font}ExtraBold` }]}>
            {profile.meals_received ?? 0}
          </Text>
          <Text style={[typography.micro, { color: colors.brownMuted, fontFamily: `${font}Regular`, textAlign: 'center' }]}>
            {t('peopleHelped')}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCell}>
          <Text style={[typography.huge, { fontSize: 22, color: colors.goldenDark, fontFamily: `${font}ExtraBold` }]}>
            {profile.rating > 0 ? profile.rating.toFixed(1) : '—'}
          </Text>
          <Text style={[typography.micro, { color: colors.brownMuted, fontFamily: `${font}Regular`, textAlign: 'center' }]}>
            {t('avgRating')}
          </Text>
        </View>
      </View>

      <View style={styles.allBadgesRow}>
        {CONTRIBUTOR_LEVELS.map(l => {
          const unlocked = profile.contributor_level >= l.level;
          return (
            <View
              key={l.level}
              style={[
                styles.miniBadge,
                { backgroundColor: unlocked ? l.bgColor : colors.surfaceMuted, borderColor: unlocked ? l.color : colors.border },
              ]}
            >
              <Text style={[styles.miniBadgeEmoji, { opacity: unlocked ? 1 : 0.4 }]}>
                {l.emoji}
              </Text>
              <Text
                style={[
                  typography.micro,
                  {
                    color: unlocked ? l.color : colors.brownMuted,
                    fontFamily: `${font}SemiBold`,
                    textAlign: 'center',
                    opacity: unlocked ? 1 : 0.5,
                  },
                ]}
                numberOfLines={1}
              >
                {t(l.labelKey)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  sectionTitle: {
    color: colors.brownMuted,
    marginBottom: spacing.sm,
  },
  currentBadgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 2,
  },
  badgeEmoji: {
    fontSize: 32,
  },
  progressSection: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressBarBg: {
    height: 10,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  maxLevelCard: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
  allBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  miniBadge: {
    alignItems: 'center',
    gap: 2,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    borderWidth: 1.5,
    minWidth: 72,
    flex: 1,
  },
  miniBadgeEmoji: {
    fontSize: 18,
  },
});

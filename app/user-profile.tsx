import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Star } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { Profile, supabase } from '@/lib/supabase';
import { colors, radius, spacing, typography } from '@/lib/theme';
import { AchievementBadgeDisplay } from '@/components/AchievementBadge';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { language, t } = useAuth(); const font = language === 'ar' ? 'Cairo-' : 'Inter-';
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => { if (id) void supabase.from('public_profiles').select('*').eq('id', id).maybeSingle().then(({ data }) => setProfile(data as Profile | null)); }, [id]);
  return <SafeAreaView style={styles.container}><View style={styles.header}><TouchableOpacity onPress={() => router.back()} style={styles.back}><Text style={styles.arrow}>{language === 'ar' ? '›' : '‹'}</Text></TouchableOpacity><Text style={[typography.heading, { color: colors.brown, fontFamily: `${font}Bold` }]}>{t('profile')}</Text></View>{!profile ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /> : <ScrollView contentContainerStyle={styles.content}>{profile.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={styles.avatar} /> : <View style={[styles.avatar, styles.fallback]}><Text style={styles.initial}>{profile.full_name?.charAt(0) ?? '?'}</Text></View>}<Text style={[typography.title, { color: colors.brown, fontFamily: `${font}Bold` }]}>{profile.full_name}</Text><View style={styles.rating}><Star size={18} color={colors.golden} fill={colors.golden} /><Text>{profile.rating.toFixed(1)}</Text></View><AchievementBadgeDisplay level={profile.contributor_level ?? 0} language={language} t={t} /></ScrollView>}</SafeAreaView>;
}
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: colors.background }, header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt }, arrow: { fontSize: 36, color: colors.brown }, content: { alignItems: 'center', padding: spacing.xl, gap: spacing.md }, avatar: { width: 110, height: 110, borderRadius: 55 }, fallback: { backgroundColor: colors.greenBg, alignItems: 'center', justifyContent: 'center' }, initial: { fontSize: 38, color: colors.greenDark, fontWeight: '700' }, rating: { flexDirection: 'row', gap: 5, alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm } });

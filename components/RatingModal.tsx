import React, { useState } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, TextInput,
  Modal, ActivityIndicator, Alert,
} from 'react-native';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { AppLanguage } from '@/lib/supabase';
import { Star, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface RatingModalProps {
  visible: boolean;
  donationId: string | null;
  matchId?: string | null;
  partnerName: string;
  language: AppLanguage;
  t: (key: string) => string;
  onClose: () => void;
  onSubmitted?: () => void;
}

export function RatingModal({
  visible, donationId, matchId, partnerName, language, t, onClose, onSubmitted,
}: RatingModalProps) {
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating < 1) return;
    if (!donationId && !matchId) return;
    setSubmitting(true);
    let error;
    if (matchId) {
      ({ error } = await supabase.rpc('submit_match_rating', {
        p_match_id: matchId,
        p_rating: rating,
        p_review: review.trim(),
      }));
    } else {
      ({ error } = await supabase.rpc('submit_food_rating', {
        p_donation_id: donationId,
        p_rating: rating,
        p_review: review.trim(),
      }));
    }
    setSubmitting(false);
    if (error) {
      Alert.alert(t('errorGeneric'));
      return;
    }
    setRating(0);
    setHoverRating(0);
    setReview('');
    onSubmitted?.();
    onClose();
  };

  const handleClose = () => {
    setRating(0);
    setHoverRating(0);
    setReview('');
    onClose();
  };

  const displayRating = hoverRating || rating;

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={[typography.heading, { color: colors.brown, fontFamily: `${font}Bold` }]}>
              {t('rateYourExperience')}
            </Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={22} color={colors.brownMuted} />
            </TouchableOpacity>
          </View>

          <Text style={[typography.body, { color: colors.brownMuted, marginBottom: spacing.md, fontFamily: `${font}Regular` }]}>
            {t('ratePartner')} {partnerName}?
          </Text>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map(n => (
              <TouchableOpacity
                key={n}
                onPress={() => setRating(n)}
                onPressIn={() => setHoverRating(n)}
                onPressOut={() => setHoverRating(0)}
                activeOpacity={0.7}
              >
                <Star
                  size={40}
                  color={n <= displayRating ? colors.golden : colors.border}
                  fill={n <= displayRating ? colors.golden : 'transparent'}
                  strokeWidth={2}
                />
              </TouchableOpacity>
            ))}
          </View>

          {rating > 0 && (
            <Text style={[typography.small, { color: colors.brownMuted, textAlign: 'center', marginTop: spacing.xs, fontFamily: `${font}Regular` }]}>
              {rating} / 5 {t('star')}
            </Text>
          )}

          <Text style={[typography.small, { color: colors.brownMuted, marginTop: spacing.md, marginBottom: spacing.xs, fontFamily: `${font}Regular` }]}>
            {t('addReview')}
          </Text>
          <TextInput
            style={styles.reviewInput}
            value={review}
            onChangeText={setReview}
            placeholder={t('addReviewPlaceholder')}
            placeholderTextColor={colors.brownMuted}
            multiline
            numberOfLines={3}
            maxLength={300}
          />

          <TouchableOpacity
            style={[styles.submitBtn, rating < 1 && { opacity: 0.4 }]}
            onPress={handleSubmit}
            disabled={rating < 1 || submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>
                {t('submitRating')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: colors.overlay,
    justifyContent: 'center', alignItems: 'center', padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, width: '100%',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm,
  },
  starsRow: {
    flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md,
  },
  reviewInput: {
    ...typography.body, color: colors.brown,
    backgroundColor: colors.surfaceAlt, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    marginBottom: spacing.md, minHeight: 80, textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: radius.lg,
    paddingVertical: spacing.md, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 3,
  },
});

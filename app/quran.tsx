import React, { useState, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Dimensions, Platform } from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { WebView } from 'react-native-webview';

const TOTAL_PAGES = 604;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const pageImageUrl = (page: number) =>
  `https://cdn.jsdelivr.net/gh/quranpedia/quran-svg@main/mushafs/hafs/kfqc/svg/${String(page).padStart(3, '0')}.svg`;

const pageHtml = (page: number) => `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #FFF8F0;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    overflow-x: hidden;
  }
  img {
    width: 100%;
    max-width: ${SCREEN_WIDTH}px;
    height: auto;
    display: block;
  }
</style>
</head>
<body>
  <img src="${pageImageUrl(page)}" alt="Quran page ${page}" />
</body>
</html>
`;

export default function QuranScreen() {
  const { t, language, rtl } = useAuth();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';

  const goToPage = useCallback((p: number) => {
    const clamped = Math.max(1, Math.min(TOTAL_PAGES, p));
    setPage(clamped);
    setLoading(true);
  }, []);

  const goPrev = () => goToPage(page - 1);
  const goNext = () => goToPage(page + 1);

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('quranMushaf')} />

      <View style={styles.pageInfoBar}>
        <Text style={[styles.pageInfoText, { fontFamily: `${font}SemiBold` }]}>
          {t('pageOf')} {page} / {TOTAL_PAGES}
        </Text>
      </View>

      <View style={styles.pageContainer}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { fontFamily: `${font}Regular` }]}>
              {t('loading')}
            </Text>
          </View>
        )}
        <WebView
          ref={webViewRef}
          source={{ html: pageHtml(page) }}
          style={styles.webView}
          scrollEnabled
          showsVerticalScrollIndicator={false}
          onLoadEnd={() => setLoading(false)}
          originWhitelist={['*']}
          javaScriptEnabled={false}
          scalesPageToFit={Platform.OS === 'android'}
        />
      </View>

      <View style={styles.navBar}>
        <TouchableOpacity
          style={[styles.navButton, page <= 1 && styles.navButtonDisabled]}
          onPress={goPrev}
          disabled={page <= 1}
          activeOpacity={0.7}
        >
          {rtl ? <ChevronRight size={24} color={page <= 1 ? colors.border : colors.white} /> : <ChevronLeft size={24} color={page <= 1 ? colors.border : colors.white} />}
          <Text style={[styles.navText, { fontFamily: `${font}SemiBold` }]}>{t('prevPage')}</Text>
        </TouchableOpacity>

        <View style={styles.pageDots}>
          <Text style={[styles.juzText, { fontFamily: `${font}SemiBold` }]}>
            {t('juz')} {Math.ceil(page / 20)}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.navButton, page >= TOTAL_PAGES && styles.navButtonDisabled]}
          onPress={goNext}
          disabled={page >= TOTAL_PAGES}
          activeOpacity={0.7}
        >
          <Text style={[styles.navText, { fontFamily: `${font}SemiBold` }]}>{t('nextPage')}</Text>
          {rtl ? <ChevronLeft size={24} color={page >= TOTAL_PAGES ? colors.border : colors.white} /> : <ChevronRight size={24} color={page >= TOTAL_PAGES ? colors.border : colors.white} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  pageInfoBar: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pageInfoText: {
    ...typography.caption,
    color: colors.brown,
  },
  pageContainer: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    zIndex: 1,
  },
  loadingText: {
    ...typography.caption,
    color: colors.brownMuted,
    marginTop: spacing.sm,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  navButtonDisabled: {
    backgroundColor: colors.surfaceMuted,
  },
  navText: {
    ...typography.small,
    color: colors.white,
  },
  pageDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  juzText: {
    ...typography.small,
    color: colors.brownMuted,
  },
});

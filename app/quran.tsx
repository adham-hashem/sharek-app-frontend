import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { Bookmark, Minus, Plus } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { ScreenHeader } from '@/components/ScreenHeader';
import { getMushafPage, QURAN_PAGE_COUNT } from '@/lib/quranOffline';
import { SURAHS } from '@/lib/quranIndex';

type Reading = { page: number; bookmarks: number[]; days: Record<string, number[]>; lastReadAt: string | null };
const initial: Reading = { page: 1, bookmarks: [], days: {}, lastReadAt: null };
const juzStarts = [1,22,42,62,82,102,121,142,162,182,201,222,242,262,282,302,322,342,362,382,402,422,442,462,482,502,522,542,562,582];
const juz = (page: number) => juzStarts.reduce((v, p, i) => page >= p ? i + 1 : v, 1);
const today = () => new Date().toLocaleDateString('en-CA');

export default function QuranScreen() {
  const { user, profile, language } = useAuth();
  const ar = language === 'ar';
  const label = (a: string, e: string) => ar ? a : e;
  const allowed = Boolean(user && profile?.religion === 'muslim');
  const key = user ? `sharek_quran_reading_v1_${user.id}` : '';
  const [data, setData] = useState<Reading>(initial);
  const [ready, setReady] = useState(false);
  const [reading, setReading] = useState(false);
  const [showIndex, setShowIndex] = useState<'juz' | 'surah' | null>(null);
  const [jump, setJump] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pageUri, setPageUri] = useState<string | null>(null);
  const [pageError, setPageError] = useState(false);
  const [retry, setRetry] = useState(0);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    setData(initial); setReady(false); setReading(false);
    if (!allowed) return;
    AsyncStorage.getItem(key).then(raw => {
      if (!active) return;
      if (raw) try {
        const saved = JSON.parse(raw) as Reading;
        if (Number.isInteger(saved.page) && saved.page >= 1 && saved.page <= QURAN_PAGE_COUNT)
          setData({ page: saved.page, bookmarks: Array.isArray(saved.bookmarks) ? saved.bookmarks : [], days: saved.days ?? {}, lastReadAt: saved.lastReadAt ?? null });
      } catch { /* Damaged local state starts at page one. */ }
      setReady(true);
    }).catch(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [allowed, key]);

  const save = useCallback((next: Reading) => {
    setData(next);
    AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
  }, [key]);
  const go = (page: number) => {
    if (!Number.isInteger(page) || page < 1 || page > QURAN_PAGE_COUNT) return;
    const date = today(), pages = data.days[date] ?? [];
    save({ ...data, page, lastReadAt: new Date().toISOString(), days: { ...data.days, [date]: pages.includes(page) ? pages : [...pages, page] } });
    setReading(true); setShowIndex(null);
  };
  useEffect(() => {
    if (!reading || !allowed) return;
    let active = true;
    setPageUri(null); setPageError(false);
    getMushafPage(data.page).then(svg => {
      if (active) setPageUri(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    }).catch(() => { if (active) setPageError(true); });
    return () => { active = false; };
  }, [reading, allowed, data.page, retry]);

  const button = (text: string, onPress: () => void, primary = false) =>
    <TouchableOpacity accessibilityRole="button" onPress={onPress} style={[styles.button, primary && styles.primary]}><Text style={[styles.buttonText, primary && styles.white]}>{text}</Text></TouchableOpacity>;
  if (!allowed) return <View style={styles.root}><ScreenHeader title={label('وردك اليومي', 'Your Daily Reading')} /><Text style={styles.note}>{label('هذا القسم متاح للحسابات المسجلة كمسلمة فقط.', 'This section is only available to accounts registered as Muslim.')}</Text></View>;
  if (!ready) return <View style={styles.root}><ActivityIndicator style={{ marginTop: 60 }} /></View>;
  const bookmarked = data.bookmarks.includes(data.page);
  return <View style={styles.root}>
    <ScreenHeader title={label('وردك اليومي', 'Your Daily Reading')} />
    {!reading ? <ScrollView contentContainerStyle={styles.dashboard}>
      <Text style={styles.title}>{label('وردك اليومي', 'Your Daily Reading')}</Text>
      <Text style={styles.sub}>{label('اقرأ بتؤدة، وتابع من حيث توقفت.', 'Read at your own pace and continue where you stopped.')}</Text>
      <View style={styles.card}><Text style={styles.heading}>{label('آخر موضع قراءة', 'Last reading position')}</Text><Text style={styles.big}>{data.page} / {QURAN_PAGE_COUNT}</Text><Text style={styles.sub}>{label('الجزء', 'Juz')} {juz(data.page)} · {Math.round(data.page / QURAN_PAGE_COUNT * 100)}%</Text><Text style={styles.sub}>{data.lastReadAt ? new Date(data.lastReadAt).toLocaleString(language) : label('لم تبدأ القراءة بعد', 'Not started yet')}</Text>{button(data.lastReadAt ? label('متابعة وردي', 'Continue reading') : label('ابدأ وردك اليومي', 'Start reading'), () => go(data.page), true)}</View>
      <View style={styles.card}><Text style={styles.heading}>{label('تقدم اليوم', "Today's progress")}</Text><Text style={styles.big}>{data.days[today()]?.length ?? 0}</Text><Text style={styles.sub}>{label('صفحات قرأتها اليوم', 'pages read today')}</Text>{(data.days[today()]?.length ?? 0) >= 2 && <Text style={styles.green}>{label('أحسنت، أتممت وردك اليومي 🌿', 'Well done, you completed your daily reading 🌿')}</Text>}</View>
      <View style={styles.card}><Text style={styles.heading}>{label('الصفحات المحفوظة', 'Bookmarks')}</Text>{data.bookmarks.length ? [...data.bookmarks].sort((a,b) => a-b).map(page => <TouchableOpacity key={page} onPress={() => go(page)} style={styles.row}><Bookmark size={17} color="#D76743" /><Text>{label('صفحة', 'Page')} {page}</Text></TouchableOpacity>) : <Text style={styles.sub}>{label('لا توجد علامات حفظ بعد', 'No bookmarks yet')}</Text>}</View>
      <View style={styles.card}><Text style={styles.heading}>{label('سجل القراءة', 'Reading history')}</Text>{Object.entries(data.days).sort(([a], [b]) => b.localeCompare(a)).slice(0, 14).map(([date, pages]) => <View key={date} style={styles.row}><Text style={styles.sub}>{date} · {pages.length} {label('صفحة', 'pages')}</Text></View>)}</View>
      {button(label('فهرس الأجزاء', 'Juz index'), () => setShowIndex(showIndex === 'juz' ? null : 'juz'))}
      {showIndex === 'juz' && <View style={styles.card}>{juzStarts.map((page, i) => <TouchableOpacity key={page} style={styles.row} onPress={() => go(page)}><Text>{label('الجزء', 'Juz')} {i + 1} · {label('صفحة', 'Page')} {page}</Text></TouchableOpacity>)}</View>}
      {button(label('فهرس السور', 'Surah index'), () => setShowIndex(showIndex === 'surah' ? null : 'surah'))}
      {showIndex === 'surah' && <View style={styles.card}>{SURAHS.map(surah => <TouchableOpacity key={surah.n} style={styles.row} onPress={() => go(surah.p)}><Text>{surah.n}. {ar ? surah.a : surah.e} · {label('صفحة', 'Page')} {surah.p}</Text></TouchableOpacity>)}</View>}
    </ScrollView> : <View style={styles.reader}>
      <View style={styles.toolbar}><Text style={styles.heading}>{label('الجزء', 'Juz')} {juz(data.page)} · {label('صفحة', 'Page')} {data.page}</Text><TouchableOpacity onPress={() => save({ ...data, bookmarks: bookmarked ? data.bookmarks.filter(p => p !== data.page) : [...data.bookmarks, data.page] })}><Bookmark size={21} color="#D76743" fill={bookmarked ? '#D76743' : 'none'} /></TouchableOpacity><TouchableOpacity onPress={() => setZoom(Math.max(1, zoom - .2))}><Minus size={21} color="#D76743" /></TouchableOpacity><TouchableOpacity onPress={() => setZoom(Math.min(2.4, zoom + .2))}><Plus size={21} color="#D76743" /></TouchableOpacity></View>
      <View style={styles.page} onTouchStart={event => { touchX.current = event.nativeEvent.pageX; }} onTouchEnd={event => { if (touchX.current == null) return; const delta = event.nativeEvent.pageX - touchX.current; touchX.current = null; if (Math.abs(delta) > 75) go(data.page + (delta > 0 ? 1 : -1)); }}>{!pageUri && !pageError && <ActivityIndicator color="#D76743" />}{pageError && button(label('تعذر فتح الصفحة، حاول مجددًا', 'Could not open page. Retry'), () => setRetry(v => v + 1))}{pageUri && (Platform.OS === 'web' ? <Image source={{ uri: pageUri }} resizeMode="contain" style={[styles.image, { transform: [{ scale: zoom }] }]} /> : <WebView key={`${data.page}-${zoom}`} originWhitelist={['*']} source={{ html: `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:white"><img src="${pageUri}" style="width:${zoom * 100}%;height:auto"/></body></html>` }} style={styles.image} />)}</View>
      <View style={styles.nav}>{button(label('السابق', 'Previous'), () => go(data.page - 1))}{button(label('الفهرس', 'Index'), () => { setReading(false); setShowIndex('surah'); })}{button(label('التالي', 'Next'), () => go(data.page + 1))}</View>
      <View style={styles.nav}><TextInput value={jump} onChangeText={setJump} keyboardType="number-pad" placeholder={label('رقم الصفحة', 'Page number')} style={styles.input} />{button(label('انتقال', 'Go'), () => { go(Number(jump)); setJump(''); })}</View>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FCFBF7' }, dashboard: { padding: 20, gap: 14, paddingBottom: 40 }, title: { fontSize: 23, fontWeight: '700', color: '#40362C', textAlign: 'center' }, sub: { color: '#796F65', lineHeight: 22, textAlign: 'center' }, note: { padding: 24, color: '#796F65' }, card: { backgroundColor: 'white', borderRadius: 20, borderWidth: 1, borderColor: '#EFE9DC', padding: 18, gap: 9 }, heading: { fontSize: 16, fontWeight: '600', color: '#40362C' }, big: { fontSize: 30, fontWeight: '700', color: '#D76743' }, green: { color: '#34775C' }, row: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: .5, borderBottomColor: '#EAE5DD' }, button: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 13, backgroundColor: '#F0F5EE', alignItems: 'center', justifyContent: 'center' }, primary: { backgroundColor: '#D76743' }, buttonText: { fontSize: 13, fontWeight: '600', color: '#B04B2D' }, white: { color: 'white' }, reader: { flex: 1 }, toolbar: { minHeight: 49, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: 'white' }, page: { flex: 1, justifyContent: 'center', overflow: 'hidden', backgroundColor: 'white' }, image: { width: '100%', height: '100%' }, nav: { flexDirection: 'row', justifyContent: 'space-around', gap: 6, paddingVertical: 6, backgroundColor: 'white' }, input: { minWidth: 110, borderWidth: 1, borderColor: '#EAE5DD', borderRadius: 10, textAlign: 'center' },
});

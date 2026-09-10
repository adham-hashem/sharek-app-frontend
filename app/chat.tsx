import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { supabase, Message, FoodDonation, Profile } from '@/lib/supabase';
import { apiFetch, apiPost } from '@/lib/api';
import { ChevronLeft, Send, UtensilsCrossed, MessageCircle } from 'lucide-react-native';

export default function ChatScreen() {
  const { t, language, user } = useAuth();
  const params = useLocalSearchParams<{ donationId?: string; mealRequestId?: string; otherUserId: string }>();
  const donationId = params.donationId;
  const mealRequestId = params.mealRequestId;
  const otherUserId = params.otherUserId;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [donation, setDonation] = useState<FoodDonation | null>(null);
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const font = language === 'ar' ? 'Cairo-' : 'Inter-';
  const rtl = language === 'ar';

  const loadMessages = useCallback(async () => {
    if (!donationId && !mealRequestId) return;
    const scope = donationId ? 'food' : 'request';
    const id = donationId ?? mealRequestId;
    const { items } = await apiFetch<{ items: Message[] }>(`/v1/chat/${scope}/${id}`).catch(() => ({ items: [] as Message[] }));
    if (items) {
      setMessages(items);
      // Mark unread messages from the other user as read
      const unread = items.filter(
        m => m.recipient_id === user?.id && m.read_at === null
      );
      await Promise.all(unread.map(m =>
        supabase.rpc('mark_message_read', { p_message_id: m.id })
      ));
    }
    setLoading(false);
  }, [donationId, mealRequestId, user]);

  const loadDonation = useCallback(async () => {
    if (!donationId) return;
    const { data } = await supabase
      .from('food_donations')
      .select('*')
      .eq('id', donationId)
      .maybeSingle();
    if (data) setDonation(data as FoodDonation);
  }, [donationId]);

  const loadOtherProfile = useCallback(async () => {
    if (!otherUserId) return;
    const { data } = await supabase
      .from('public_profiles')
      .select('*')
      .eq('id', otherUserId)
      .maybeSingle();
    if (data) setOtherProfile(data as Profile);
  }, [otherUserId]);

  useEffect(() => {
    loadDonation();
    loadOtherProfile();
    loadMessages();
  }, [loadDonation, loadOtherProfile, loadMessages]);

  useEffect(() => {
    if (!donationId && !mealRequestId) return;
    const channelId = donationId ?? mealRequestId!;
    const channel = supabase
      .channel(`chat_${channelId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: donationId
          ? `food_donation_id=eq.${donationId}`
          : `meal_request_id=eq.${mealRequestId}`,
      }, async (payload) => {
        const newMsg = payload.new as Message;
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        // Auto-mark incoming messages as read
        if (newMsg.recipient_id === user?.id && newMsg.read_at === null) {
          await supabase.rpc('mark_message_read', { p_message_id: newMsg.id });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [donationId, mealRequestId, user]);

  useEffect(() => {
    if (scrollRef.current && messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const sendMessage = async () => {
    const body = input.trim();
    if (!body || !user || !otherUserId) return;
    if (!donationId && !mealRequestId) return;
    setSending(true);
    setInput('');
    const scope = donationId ? 'food' : 'request';
    const id = donationId ?? mealRequestId;
    const { error } = await apiPost<Message>(`/v1/chat/${scope}/${id}/messages`, {
      recipient_id: otherUserId,
      body,
    }).then(() => ({ error: null as unknown })).catch((err) => ({ error: err }));
    setSending(false);
    if (error) {
      setInput(body);
    }
  };

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.brown} style={{ transform: [{ scaleX: rtl ? -1 : 1 }] }} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatar}>
            <Text style={[typography.bodyBold, { color: colors.white, fontFamily: `${font}Bold` }]}>
              {otherProfile?.full_name?.charAt(0).toUpperCase() ?? '?'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]} numberOfLines={1}>
              {otherProfile?.full_name ?? '...'}
            </Text>
            {donation && (
              <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]} numberOfLines={1}>
                {donation.food_name} · {donation.meals} {t('meals')}
              </Text>
            )}
          </View>
        </View>
      </View>

      {donation && (
        <View style={styles.foodBanner}>
          {donation.image_url ? (
            <Image source={{ uri: donation.image_url }} style={styles.foodBannerImg} />
          ) : (
            <View style={[styles.foodBannerImg, { backgroundColor: colors.greenBg, justifyContent: 'center', alignItems: 'center' }]}>
              <UtensilsCrossed size={20} color={colors.green} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>
              {t('foodItem')}
            </Text>
            <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold` }]} numberOfLines={1}>
              {donation.food_name}
            </Text>
          </View>
          <View style={styles.mealsBadge}>
            <Text style={[typography.micro, { color: colors.greenDark, fontFamily: `${font}Bold` }]}>
              {donation.meals} {t('meals')}
            </Text>
          </View>
        </View>
      )}

      {/* Messages */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.messagesScroll}
            contentContainerStyle={{ paddingVertical: spacing.md, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
          >
            {messages.length === 0 ? (
              <View style={styles.emptyChat}>
                <MessageCircle size={40} color={colors.brownMuted} />
                <Text style={[typography.body, { color: colors.brownMuted, marginTop: spacing.md, textAlign: 'center', fontFamily: `${font}Regular` }]}>
                  {t('noMessages')}
                </Text>
              </View>
            ) : (
              messages.map((msg) => {
                const isMine = msg.sender_id === user?.id;
                return (
                  <View
                    key={msg.id}
                    style={[styles.msgBubble, isMine ? styles.msgMine : styles.msgTheirs]}
                  >
                    <Text style={[
                      typography.body,
                      { color: isMine ? colors.white : colors.brown, fontFamily: `${font}Regular` },
                    ]}>
                      {msg.body}
                    </Text>
                    <Text style={[
                      typography.micro,
                      { color: isMine ? 'rgba(255,255,255,0.7)' : colors.brownMuted, marginTop: 2, alignSelf: 'flex-end', fontFamily: `${font}Regular` },
                    ]}>
                      {fmtTime(msg.created_at)}
                    </Text>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder={t('typeMessage')}
            value={input}
            onChangeText={setInput}
            placeholderTextColor={colors.brownMuted}
            multiline
            maxLength={500}
            editable={!loading}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.4 }]}
            onPress={sendMessage}
            disabled={!input.trim() || sending}
            activeOpacity={0.7}
          >
            {sending ? <ActivityIndicator color={colors.white} size={18} /> : <Send size={20} color={colors.white} />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderBottomWidth: 1.5, borderColor: colors.border,
  },
  backBtn: { padding: spacing.xs },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  foodBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderColor: colors.border,
  },
  foodBannerImg: { width: 40, height: 40, borderRadius: radius.sm },
  mealsBadge: {
    backgroundColor: colors.greenBg, borderRadius: radius.pill,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messagesScroll: { flex: 1, paddingHorizontal: spacing.md },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },
  msgBubble: {
    maxWidth: '78%', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  msgMine: {
    backgroundColor: colors.primary, alignSelf: 'flex-end',
    borderBottomRightRadius: radius.sm,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 2,
  },
  msgTheirs: {
    backgroundColor: colors.surfaceAlt, alignSelf: 'flex-start',
    borderBottomLeftRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderTopWidth: 1.5, borderColor: colors.border,
  },
  textInput: {
    ...typography.body, color: colors.brown,
    flex: 1, maxHeight: 100, minHeight: 40,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    borderWidth: 1.5, borderColor: colors.border,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 3,
  },
});

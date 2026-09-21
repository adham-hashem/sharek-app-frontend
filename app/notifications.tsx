import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { supabase, Notification, NotificationType } from '@/lib/supabase';
import {
  fetchNotifications, markNotificationRead, markAllNotificationsRead,
  getNotificationMeta, timeAgo, getNotificationRoute, playNotificationFeedback,
} from '@/lib/notifications';
import {
  ChevronLeft, Bell, CheckCheck, MessageCircle, UtensilsCrossed,
  Heart, Package, CheckCircle2, Navigation, Star, Clock,
  XCircle, HandHeart,
} from 'lucide-react-native';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  UtensilsCrossed,
  Package,
  CheckCircle2,
  Heart,
  HandHeart,
  XCircle,
  Clock,
  MessageCircle,
  Navigation,
  Star,
};

function NotificationIcon({ type, size, color }: { type: NotificationType; size: number; color: string }) {
  const meta = getNotificationMeta(type);
  const Icon = ICON_MAP[meta.icon] ?? Bell;
  return <Icon size={size} color={color} />;
}

export default function NotificationsScreen() {
  const { t, language, user } = useAuth();
  const insets = useSafeAreaInsets();
  const font = language === 'ar' ? 'Cairo-' : 'Inter-';
  const rtl = language === 'ar';

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const settingsRef = useRef<any>(null);

  useEffect(() => {
    if (user) {
      supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => { settingsRef.current = data ?? { notifications_enabled: true, request_sound_enabled: true, vibration_enabled: true }; });
    }
  }, [user]);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    const data = await fetchNotifications(user.id);
    setNotifications(data);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!user) return;
    const sub = supabase
      .channel('notifications_realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const newNotif = payload.new as Notification;
        setNotifications(prev => {
          if (prev.some(n => n.id === newNotif.id)) return prev;
          return [newNotif, ...prev];
        });
        playNotificationFeedback(newNotif.type, settingsRef.current ?? { notifications_enabled: true, request_sound_enabled: true, vibration_enabled: true });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const updated = payload.new as Notification;
        setNotifications(prev => prev.map(n => n.id === updated.id ? updated : n));
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [user]);

  const handleNotificationPress = useCallback(async (notif: Notification) => {
    if (!notif.read_at) {
      await markNotificationRead(notif.id);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n));
    }

    const route = getNotificationRoute(notif);
    if (route) {
      const [pathname, query] = route.split('?');
      const params: Record<string, string> = {};
      if (query) {
        query.split('&').forEach(pair => {
          const [k, v] = pair.split('=');
          params[k] = v;
        });
      }
      router.push({ pathname: pathname! as never, params });
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    setMarkingAll(true);
    await markAllNotificationsRead();
    setNotifications(prev => prev.map(n => n.read_at ? n : { ...n, read_at: new Date().toISOString() }));
    setMarkingAll(false);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications();
  }, [loadNotifications]);

  const unreadCount = notifications.filter(n => !n.read_at).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']} mode="padding">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
          <Text style={styles.backArrow}>{rtl ? '›' : '‹'}</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Bell size={20} color={colors.brown} />
          <Text style={[typography.heading, { color: colors.brown, fontFamily: `${font}Bold` }]}>
            {t('notificationsTitle')}
          </Text>
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={[typography.micro, { color: colors.white, fontFamily: `${font}Bold` }]}>
                {unreadCount}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          onPress={handleMarkAllRead}
          disabled={markingAll || unreadCount === 0}
          style={[styles.markAllBtn, (markingAll || unreadCount === 0) && { opacity: 0.4 }]}
          activeOpacity={0.7}
        >
          {markingAll ? (
            <ActivityIndicator color={colors.primary} size={14} />
          ) : (
            <>
              <CheckCheck size={16} color={colors.primary} />
              <Text style={[typography.small, { color: colors.primary, fontFamily: `${font}Bold` }]}>
                {t('markAllRead')}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Bell size={40} color={colors.brownMuted} />
          </View>
          <Text style={[typography.bodyBold, { color: colors.brown, fontFamily: `${font}Bold`, marginTop: spacing.md }]}>
            {t('noNotifications')}
          </Text>
          <Text style={[typography.caption, { color: colors.brownMuted, marginTop: spacing.xs, fontFamily: `${font}Regular`, textAlign: 'center' }]}>
            {t('noNotificationsDesc')}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
          }
        >
          {notifications.map((notif) => {
            const meta = getNotificationMeta(notif.type);
            const isUnread = !notif.read_at;
            return (
              <TouchableOpacity
                key={notif.id}
                style={[styles.notifCard, isUnread && styles.notifCardUnread]}
                onPress={() => handleNotificationPress(notif)}
                activeOpacity={0.7}
              >
                <View style={[styles.notifIcon, { backgroundColor: meta.bgColor }]}>
                  <NotificationIcon type={notif.type} size={20} color={meta.color} />
                </View>
                <View style={styles.notifBody}>
                  <View style={styles.notifHeader}>
                    <Text style={[typography.small, { color: colors.brown, fontFamily: `${font}Bold`, flex: 1 }]} numberOfLines={1}>
                      {notif.title}
                    </Text>
                    {isUnread && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]} numberOfLines={2}>
                    {notif.body}
                  </Text>
                  <Text style={[typography.micro, { color: colors.brownMuted, fontFamily: `${font}Regular`, marginTop: 2 }]}>
                    {timeAgo(notif.created_at, language)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderBottomWidth: 1.5, borderColor: colors.border,
  },
  backBtn: {
    width: 46, height: 46, borderRadius: 23,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2, borderColor: colors.primary,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1, shadowRadius: 8, elevation: 4,
  },
  backArrow: {
    color: colors.brown,
    fontSize: 38,
    lineHeight: 40,
    fontWeight: '800',
    marginTop: -3,
  },
  headerTitleWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1, justifyContent: 'center',
  },
  headerBadge: {
    backgroundColor: colors.coral, borderRadius: 10, minWidth: 20, height: 20,
    paddingHorizontal: 5, justifyContent: 'center', alignItems: 'center',
  },
  markAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
  },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surfaceAlt,
    justifyContent: 'center', alignItems: 'center',
  },
  scroll: { flex: 1 },
  notifCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    marginHorizontal: spacing.lg, marginBottom: spacing.sm,
    borderWidth: 1.5, borderColor: colors.border,
  },
  notifCardUnread: {
    borderColor: colors.primary,
    backgroundColor: '#FFF8F0',
  },
  notifIcon: {
    width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center',
  },
  notifBody: { flex: 1, gap: 2 },
  notifHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  unreadDot: {
    width: 9, height: 9, borderRadius: 5, backgroundColor: colors.coral,
  },
});

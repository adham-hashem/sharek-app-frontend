import { useEffect, useState } from 'react';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider, useAuth } from '@/lib/auth';
import { useFonts } from 'expo-font';
import {
  Cairo_400Regular,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
} from '@expo-google-fonts/cairo';
import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { I18nManager, View } from 'react-native';
import { colors } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

function RootNav() {
  const { loading, session } = useAuth();
  const pathname = usePathname();
  const segments = useSegments();
  const router = useRouter();
  const isAuthRoute = segments[0] === '(auth)';
  const isPasswordRecoveryRoute = pathname === '/forgot-password' || pathname === '/reset-password';

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('access_token') && window.location.hash.includes('type=recovery')) {
      router.replace('/reset-password' as any);
      return;
    }
    if (loading || session || pathname === '/' || isAuthRoute || isPasswordRecoveryRoute) return;
    router.replace('/(auth)/welcome');
  }, [isAuthRoute, isPasswordRecoveryRoute, loading, pathname, router, session]);

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)/welcome" />
      <Stack.Screen name="(auth)/language" />
      <Stack.Screen name="(auth)/register" />
      <Stack.Screen name="(auth)/login" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="change-password" />
      <Stack.Screen name="(auth)/role" />
      <Stack.Screen name="(auth)/mode" />
      <Stack.Screen name="(auth)/country" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="donate-money" />
      <Stack.Screen name="donate-sharek" />
      <Stack.Screen name="admin-dashboard" />
      <Stack.Screen name="admin-role-requests" />
      <Stack.Screen name="admin" />
      <Stack.Screen name="history" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="quran" />
      <Stack.Screen name="support" />
      <Stack.Screen name="verify-account" />
      <Stack.Screen name="admin-verification" />
      <Stack.Screen name="admin-ratings" />
      <Stack.Screen name="admin-users" />
      <Stack.Screen name="admin-reports" />
      <Stack.Screen name="report-problem" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  const [fontsLoaded, fontError] = useFonts({
    'Cairo-Regular': Cairo_400Regular,
    'Cairo-SemiBold': Cairo_600SemiBold,
    'Cairo-Bold': Cairo_700Bold,
    'Cairo-ExtraBold': Cairo_800ExtraBold,
    'Inter-Regular': Inter_400Regular,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  const [langReady, setLangReady] = useState(false);

  useEffect(() => {
    (async () => {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const saved = await AsyncStorage.getItem('sharek_lang');
      const lang = saved === 'en' ? 'en' : 'ar';
      const rtl = lang === 'ar';
      if (I18nManager.isRTL !== rtl) {
        I18nManager.forceRTL(rtl);
      }
      setLangReady(true);
    })();
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && langReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, langReady]);

  if (!fontsLoaded || !langReady || fontError) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <AuthProvider>
      <RootNav />
      <StatusBar style="dark" />
    </AuthProvider>
  );
}

export const unstable_settings = {
  initialRouteName: 'index',
};

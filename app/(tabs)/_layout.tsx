import { Redirect, Tabs } from 'expo-router';
import { Home, Heart, HandHeart, Menu } from 'lucide-react-native';
import { colors } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { Platform, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallPhone = SCREEN_WIDTH < 360;
const isWeb = Platform.OS === 'web';

export default function TabLayout() {
  const { t, language, session } = useAuth();

  if (!session) {
    return <Redirect href="/(auth)/welcome" />;
  }

  const labelSize = isSmallPhone ? 10 : 11;
  const iconSize = isSmallPhone ? 20 : 23;
  const barHeight = isWeb ? 62 : isSmallPhone ? 62 : 66;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.brownMuted,
        tabBarShowLabel: true,
        tabBarAllowFontScaling: false,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.borderLight,
          borderTopWidth: 1,
          height: barHeight,
          paddingBottom: 6,
          paddingTop: 6,
          paddingHorizontal: 4,
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          elevation: 10,
          shadowColor: colors.shadowStrong,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 1,
          shadowRadius: 10,
        },
        tabBarLabelStyle: {
          fontFamily: language === 'ar' ? 'Cairo-SemiBold' : 'Inter-SemiBold',
          fontSize: labelSize,
          marginTop: 3,
          marginBottom: 2,
          includeFontPadding: false,
          textAlign: 'center',
        },
        tabBarIconStyle: {
          marginBottom: 0,
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
          paddingHorizontal: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('home'),
          tabBarIcon: ({ color }) => <Home size={iconSize} color={color} />,
        }}
      />
      <Tabs.Screen
        name="request"
        options={{
          title: t('request'),
          tabBarIcon: ({ color }) => <Heart size={iconSize} color={color} />,
        }}
      />
      <Tabs.Screen
        name="donate"
        options={{
          title: t('donate'),
          tabBarIcon: ({ color }) => <HandHeart size={iconSize} color={color} />,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: t('menu'),
          tabBarIcon: ({ color }) => <Menu size={iconSize} color={color} />,
        }}
      />
    </Tabs>
  );
}

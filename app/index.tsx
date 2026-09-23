import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';

export default function Index() {
  const { session, profile, loading } = useAuth();

  if (loading) return null;

  if (!session) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (!profile || profile.role === 'skipped') {
    return <Redirect href="/(auth)/role" />;
  }

  if (['charity', 'organization', 'restaurant', 'hotel'].includes(profile.role) && !profile.mode) {
    return <Redirect href={'/(auth)/mode' as never} />;
  }

  if (!profile.country?.trim()) {
    return <Redirect href={'/(auth)/country' as never} />;
  }

  return <Redirect href="/(tabs)" />;
}

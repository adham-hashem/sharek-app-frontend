import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';

export default function Index() {
  const { session, profile, loading } = useAuth();

  if (loading) return null;

  if (!session) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (profile?.role === 'skipped') {
    return <Redirect href="/(auth)/role" />;
  }

  return <Redirect href="/(tabs)" />;
}

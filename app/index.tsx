import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';

export default function Index() {
  const { session, profile, loading } = useAuth();

  if (loading) return null;

  if (!session) {
    return <Redirect href="/(auth)/welcome" />;
  }

  // We no longer force redirect to role if 'skipped', because 'skipped' is a valid fallback state 
  // and forcing it creates an infinite loop if the user intentionally skips or fails to set a restricted role.
  // The app resolves 'skipped' gracefully to 'donor' mode via effectiveMode.

  return <Redirect href="/(tabs)" />;
}

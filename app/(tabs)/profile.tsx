import { useLocalSearchParams } from 'expo-router';
import ProfileAndMenu from '@/components/ProfileAndMenu';

export default function ProfileScreen() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  return <ProfileAndMenu profileView initialSection={section} />;
}

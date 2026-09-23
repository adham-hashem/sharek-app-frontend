import { useLocalSearchParams } from 'expo-router';
import MenuScreen from './menu';

export default function ProfileScreen() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  return <MenuScreen profileView initialSection={section} />;
}

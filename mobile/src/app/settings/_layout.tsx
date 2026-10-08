// Settings is a stack inside its tab: the overview, then a group's page (back swipe / back button returns).
import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

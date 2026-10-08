// Settings is a stack inside its tab: the overview, then a group's page (back swipe / back button returns).
import { Stack } from 'expo-router';

// the overview first: unnamed, a native stack starts on "[group]" (it sorts before "index") and has nothing to go back to
export const unstable_settings = { initialRouteName: 'index' };

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[group]" />
    </Stack>
  );
}

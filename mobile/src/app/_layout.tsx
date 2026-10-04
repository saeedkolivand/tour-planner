import '../../global.css';

import { PortalHost } from '@rn-primitives/portal';
import { Tabs, ThemeProvider, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ListChecks, Navigation, ScanBarcode, Settings, type LucideIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useEffect } from 'react';
import { Platform, Text, type ColorValue } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TourProvider } from '@/features/tour/TourProvider';
import { useLiveSurfaces } from '@/features/tour/useLiveSurfaces';
import { NAV_THEME, THEME } from '@/lib/theme';
import { haptic } from '@/shared/haptics';
import { useTranslation } from '@/shared/i18n'; // also initializes i18next, before any screen renders
import { log } from '@/shared/log';

const nav = log('nav');

/** Mirrors the tour onto the Live Activity (incl. CarPlay Dashboard) and the Next stop widget. */
function LiveSurfaces() {
  useLiveSurfaces();
  return null;
}

const tabIcon = (as: LucideIcon) => function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  const I = as;
  return <I color={color as string} size={24} strokeWidth={focused ? 2.4 : 1.8} />;
};

// Rendered ourselves: React Navigation's default label inherits the web page's line-height and gets clipped.
const tabLabel = (title: string) => function TabLabel({ color }: { color: ColorValue }) {
  // flexShrink 0: the tab item's flex layout otherwise squeezes the label box and clips the text
  return <Text style={{ color, fontSize: 11, lineHeight: 14, fontWeight: '600', flexShrink: 0 }} numberOfLines={1}>{title}</Text>;
};

export default function RootLayout() {
  const scheme = useColorScheme().colorScheme ?? 'light';
  const { bottom } = useSafeAreaInsets();
  const { t } = useTranslation();
  const path = usePathname();
  useEffect(() => { nav.info('screen', { path }); }, [path]);
  // darkMode is 'class': native follows the system itself, the web preview needs the class set
  useEffect(() => { if (Platform.OS === 'web') document.documentElement.classList.toggle('dark', scheme === 'dark'); }, [scheme]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <ThemeProvider value={NAV_THEME[scheme]}>
      <TourProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Tabs
          screenListeners={{ tabPress: () => haptic.select() }}
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: THEME[scheme].primary,
            tabBarInactiveTintColor: THEME[scheme].mutedForeground,
            // taller than the default 49pt: bigger targets for use in the van, and room for icon + label
            tabBarStyle: { backgroundColor: THEME[scheme].card, borderTopColor: THEME[scheme].border, height: 64 + bottom, paddingTop: 6, paddingBottom: bottom + 6 },
          }}>
          <Tabs.Screen name="index" options={{ title: t('tabs.stops'), tabBarIcon: tabIcon(ListChecks), tabBarLabel: tabLabel(t('tabs.stops')) }} />
          <Tabs.Screen name="route" options={{ title: t('tabs.route'), tabBarIcon: tabIcon(Navigation), tabBarLabel: tabLabel(t('tabs.route')) }} />
          <Tabs.Screen name="scan" options={{ title: t('tabs.scan'), tabBarIcon: tabIcon(ScanBarcode), tabBarLabel: tabLabel(t('tabs.scan')) }} />
          <Tabs.Screen name="settings" options={{ title: t('tabs.settings'), tabBarIcon: tabIcon(Settings), tabBarLabel: tabLabel(t('tabs.settings')) }} />
        </Tabs>
        <LiveSurfaces />
        <PortalHost />
      </TourProvider>
    </ThemeProvider>
    </GestureHandlerRootView>
  );
}

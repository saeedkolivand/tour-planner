import { RefreshCw, Trash2 } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ScreenHeader, StatusBanner } from '@/components/Screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { ClosuresSection } from '@/features/roads/ClosuresSection';
import { NavAppPicker } from '@/features/settings/components/NavAppPicker';
import { SettingsDivider, SettingsSection, SwitchRow } from '@/features/settings/components/SettingsSection';
import { setSettings, useSettings } from '@/features/settings/settings';
import { useTourState, useTourStore } from '@/features/tour/TourProvider';
import { onDeviceOcr } from '@/services/scan';

export default function SettingsScreen() {
  const s = useSettings();
  const store = useTourStore();
  const { tour, busy, error, offline } = useTourState();
  return (
    <View className="bg-background flex-1">
      <ScreenHeader title="Settings" />
      <StatusBanner busy={busy} error={error} offline={offline} />
      <ScrollView contentContainerClassName="gap-6 px-5 pb-16" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <SettingsSection title="Start & end" footer="Without a depot, routes start from your current location.">
          <Input defaultValue={s.depot} placeholder="Depot address, e.g. Carl-Benz-Ring 1, 50374 Erftstadt" accessibilityLabel="Depot address"
            onChangeText={depot => setSettings({ depot: depot.trim() })} />
          <SettingsDivider />
          <SwitchRow label="Return to depot" hint="Plan the drive back as part of the route" value={s.endAtDepot} onChange={endAtDepot => setSettings({ endAtDepot })} />
          <SettingsDivider />
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1 gap-0.5">
              <Text className="font-medium">Leave the depot at</Text>
              <Text className="text-muted-foreground text-sm">ETAs and Express count from here when you plan while loading</Text>
            </View>
            <Input defaultValue={s.leaveAt} placeholder="08:30" keyboardType="numbers-and-punctuation" maxLength={5} className="w-24 text-center"
              accessibilityLabel="Usual departure time" onChangeText={leaveAt => setSettings({ leaveAt: leaveAt.trim() })} />
          </View>
        </SettingsSection>

        <SettingsSection title="Express" footer="On: Express stops are reached by their deadline, everything else stays fastest (usually costs a few minutes). Off: the fastest tour, Express only shown.">
          <SwitchRow label="Express on time" hint="Plan around 10:00 / 12:00 / 14:00 deadlines" value={s.expressOnTime} onChange={expressOnTime => setSettings({ expressOnTime })} />
        </SettingsSection>

        <SettingsSection title="Navigation & CarPlay" footer="Navigation opens in this app, which shows on your CarPlay screen. Deliver on the phone, drive by the car's display.">
          <NavAppPicker value={s.navApp} onChange={navApp => setSettings({ navApp })} />
          <SettingsDivider />
          <SwitchRow label="Auto-navigate" hint="After Delivered, start navigation to the next stop" value={s.autoNavigate} onChange={autoNavigate => setSettings({ autoNavigate })} />
        </SettingsSection>

        <ClosuresSection />

        <SettingsSection title="Planning" footer={s.planner === 'auto'
          ? `Plans on your PC when it answers (road map with roadworks and closures), on this phone when it doesn't. Text recognition: ${onDeviceOcr ? 'on this phone' : 'on the PC'}.`
          : 'Everything runs on this phone: reading lists and labels, addresses, and the stop order. No PC needed.'}>
          <SwitchRow label="Use my PC" hint="Best plans when it's reachable over Tailscale" value={s.planner === 'auto'}
            onChange={on => setSettings({ planner: on ? 'auto' : 'phone' })} />
          {s.planner === 'auto' && (
            <>
              <SettingsDivider />
              <Input defaultValue={s.server} placeholder="https://your-pc.your-tailnet.ts.net" autoCapitalize="none" autoCorrect={false} keyboardType="url" accessibilityLabel="Server URL"
                onChangeText={server => setSettings({ server: server.trim() })} />
              <Button variant="outline" onPress={store.load}>
                <Icon as={RefreshCw} size={16} />
                <Text>Reconnect</Text>
              </Button>
            </>
          )}
        </SettingsSection>

        <SettingsSection title="Road times on the phone" footer="Optional. With a free openrouteservice.org key, plans made on this phone use real road times (one-ways, bridges) instead of distance estimates. Needs internet, not the PC.">
          <Input defaultValue={s.orsKey} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="OpenRouteService key"
            accessibilityLabel="OpenRouteService key" onChangeText={orsKey => setSettings({ orsKey: orsKey.trim() })} />
        </SettingsSection>

        <SettingsSection title="Tour">
          <ConfirmDialog title="Clear today's tour?" body={`All ${tour.stops.length} stops, the route and delivery ticks are removed from this phone and the web app.`}
            confirm="Clear tour" destructive onConfirm={store.clear}>
            <Button variant="outline" disabled={!tour.stops.length}>
              <Icon as={Trash2} size={16} className="text-destructive" />
              <Text className="text-destructive">Clear tour</Text>
            </Button>
          </ConfirmDialog>
        </SettingsSection>
      </ScrollView>
    </View>
  );
}

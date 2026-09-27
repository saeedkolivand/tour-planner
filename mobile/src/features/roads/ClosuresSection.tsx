import { Ban, Construction, X } from 'lucide-react-native';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { SettingsSection } from '@/features/settings/components/SettingsSection';
import { noPc, useSettings } from '@/features/settings/settings';
import { friendly } from '@/features/tour/store';
import { useClosures } from './closures';

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const toward = (deg: number) => COMPASS[Math.round(deg / 45) % 8];

const ago = (at: number) => {
  const h = Math.round((Date.now() - at) / 3600_000);
  return h < 1 ? 'just now' : h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
};

/** Reported closures (removable) and what the router currently knows about the roads. */
export function ClosuresSection() {
  const s = useSettings();
  if (noPc(s)) {
    return (
      <SettingsSection title="Road closures" footer="Roadworks, the city's traffic calendar and closures you report live on your PC. In phone-only mode plans don't know about them.">
        <Text className="text-muted-foreground">Available when you use your PC.</Text>
      </SettingsSection>
    );
  }
  return <ClosuresList />;
}

function ClosuresList() {
  const { closures, roads, error, remove } = useClosures();
  const updated = roads?.appliedAt ? new Date(roads.appliedAt).toTimeString().slice(0, 5) : null;
  const footer = error ? friendly(error)
    : `City of Cologne: ${roads?.roadworks ?? '…'} roadworks and ${roads?.calendar ?? '…'} traffic-calendar closures active today${updated ? `, applied ${updated}` : ''}. The map itself, one-way streets included, refreshes every night.`;
  return (
    <SettingsSection title="Road closures" footer={footer}>
      {closures.length === 0 && <Text className="text-muted-foreground">None reported. Use the cone button on the Route tab when a street is closed or has become one-way.</Text>}
      {closures.map(c => (
        <View key={c.id} className="flex-row items-center gap-3">
          <Icon as={c.heading != null ? Ban : Construction} size={18} className="text-express" />
          <View className="flex-1">
            <Text className="font-medium" numberOfLines={1}>{c.note || `${c.lat.toFixed(4)}, ${c.lon.toFixed(4)}`}</Text>
            <Text className="text-muted-foreground text-xs">{c.heading != null ? `No entry heading ${toward(c.heading)} · ` : ''}Reported {ago(c.at)}</Text>
          </View>
          <Button variant="ghost" size="icon" onPress={() => remove(c.id)} accessibilityLabel="Remove this closure">
            <Icon as={X} size={18} className="text-muted-foreground" />
          </Button>
        </View>
      ))}
    </SettingsSection>
  );
}

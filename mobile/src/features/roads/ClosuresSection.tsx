import { Ban, Construction, X } from 'lucide-react-native';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { SettingsSection } from '@/features/settings/components/SettingsSection';
import { noPc, useSettings } from '@/features/settings/settings';
import { cantReachPc, friendly } from '@/features/tour/store';
import { t, useTranslation } from '@/shared/i18n';
import { useClosures } from './closures';

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const toward = (deg: number) => COMPASS[Math.round(deg / 45) % 8];

const ago = (at: number) => {
  const h = Math.round((Date.now() - at) / 3600_000);
  return h < 1 ? t('common.justNow') : h < 48 ? t('common.hoursAgo', { h }) : t('common.daysAgo', { d: Math.round(h / 24) });
};

/** Reported closures (removable) and what the router currently knows about the roads. */
export function ClosuresSection() {
  const { t } = useTranslation();
  const s = useSettings();
  if (noPc(s)) {
    return (
      <SettingsSection title={t('settings.roadClosures')} footer={t('settings.roadClosuresNoPcFooter')}>
        <Text className="text-muted-foreground">{t('settings.availableWithPc')}</Text>
      </SettingsSection>
    );
  }
  return <ClosuresList />;
}

function ClosuresList() {
  const { t } = useTranslation();
  const { closures, roads, error, remove } = useClosures();
  const updated = roads?.appliedAt ? new Date(roads.appliedAt).toTimeString().slice(0, 5) : null;
  const footer = error ? (cantReachPc(error) ? t('store.cantReachPc') : friendly(error))
    : t('settings.closuresFooter', { roadworks: roads?.roadworks ?? '…', calendar: roads?.calendar ?? '…', updated: updated ? t('settings.appliedAt', { time: updated }) : '' });
  return (
    <SettingsSection title={t('settings.roadClosures')} footer={footer}>
      {closures.length === 0 && <Text className="text-muted-foreground">{t('settings.noClosures')}</Text>}
      {closures.map(c => (
        <View key={c.id} className="flex-row items-center gap-3">
          <Icon as={c.heading != null ? Ban : Construction} size={18} className="text-express" />
          <View className="flex-1">
            <Text className="font-medium" numberOfLines={1}>{c.note || `${c.lat.toFixed(4)}, ${c.lon.toFixed(4)}`}</Text>
            <Text className="text-muted-foreground text-xs">{c.heading != null ? t('settings.noEntryHeading', { dir: toward(c.heading) }) : ''}{t('settings.reportedAgo', { time: ago(c.at) })}</Text>
          </View>
          <Button variant="ghost" size="icon" onPress={() => remove(c.id)} accessibilityLabel={t('settings.removeClosure')}>
            <Icon as={X} size={18} className="text-muted-foreground" />
          </Button>
        </View>
      ))}
    </SettingsSection>
  );
}

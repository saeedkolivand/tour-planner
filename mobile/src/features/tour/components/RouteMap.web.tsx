// Web build (and Android without a Google Maps key): a placeholder where the map would be.
import { Map } from 'lucide-react-native';
import { View } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useTranslation } from '@/shared/i18n';
import type { LatLon, Stop } from '../types';

export function RouteMap(_: { start: LatLon; stops: Stop[]; nextKeys: Set<string | undefined>; onMove(s: Stop, to: LatLon): void }) {
  const { t } = useTranslation();
  return (
    <View className="bg-muted border-border items-center justify-center gap-2 rounded-xl border" style={{ height: 260 }}>
      <Icon as={Map} size={28} className="text-muted-foreground" />
      <Text className="text-muted-foreground text-sm">{t('map.webPlaceholder')}</Text>
    </View>
  );
}

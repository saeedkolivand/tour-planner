import { Clock, MapPinOff, Package, Zap } from 'lucide-react-native';
import { View } from 'react-native';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useTranslation } from '@/shared/i18n';
import type { Stop } from '../types';

/** Only what deserves attention: Express deadline (or the scanner's PRIO), several parcels, an unsure map position; the scanner's slot. */
export function StopBadges({ stop }: { stop: Stop }) {
  const { t } = useTranslation();
  const many = stop.parcels > 1;
  if (!stop.express && !many && stop.exact !== false && !stop.opens && !stop.slot) return null;
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {!!stop.express && (
        <Badge className="bg-express border-transparent">
          <Icon as={Zap} size={12} className="text-express-foreground" />
          <Text className="text-express-foreground">{stop.prio ? 'PRIO' : t('common.expressValue', { value: stop.express })}</Text>
        </Badge>
      )}
      {!!stop.opens && (
        <Badge variant="outline">
          <Icon as={Clock} size={12} className="text-success-ink" />
          <Text className="text-success-ink">{t('common.openHours', { hours: stop.opens.replace(/:00/g, '').replace('-', '–') })}</Text>
        </Badge>
      )}
      {!!stop.slot && (
        <Badge variant="outline">
          <Icon as={Clock} size={12} className="text-muted-foreground" />
          <Text className="text-muted-foreground">{stop.slot.replace('-', '–')}</Text>
        </Badge>
      )}
      {many && (
        <Badge variant="secondary">
          <Icon as={Package} size={12} />
          <Text>{t('count.parcels', { count: stop.parcels })}</Text>
        </Badge>
      )}
      {stop.exact === false && (
        <Badge variant="outline">
          <Icon as={MapPinOff} size={12} className="text-muted-foreground" />
          <Text className="text-muted-foreground">{t('stops.streetOnly')}</Text>
        </Badge>
      )}
    </View>
  );
}

import { Clock, MapPinOff, Package, Zap } from 'lucide-react-native';
import { View } from 'react-native';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { Stop } from '../types';

/** Only what deserves attention: Express deadline, several parcels, an unsure map position. */
export function StopBadges({ stop }: { stop: Stop }) {
  const many = stop.parcels > 1;
  if (!stop.express && !many && stop.exact !== false && !stop.opens) return null;
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {!!stop.express && (
        <Badge className="bg-express border-transparent">
          <Icon as={Zap} size={12} className="text-express-foreground" />
          <Text className="text-express-foreground">Express {stop.express}</Text>
        </Badge>
      )}
      {!!stop.opens && (
        <Badge variant="outline">
          <Icon as={Clock} size={12} className="text-success" />
          <Text className="text-success">Open {stop.opens.replace(/:00/g, '').replace('-', '–')}</Text>
        </Badge>
      )}
      {many && (
        <Badge variant="secondary">
          <Icon as={Package} size={12} />
          <Text>{stop.parcels} parcels</Text>
        </Badge>
      )}
      {stop.exact === false && (
        <Badge variant="outline">
          <Icon as={MapPinOff} size={12} className="text-muted-foreground" />
          <Text className="text-muted-foreground">Street only</Text>
        </Badge>
      )}
    </View>
  );
}

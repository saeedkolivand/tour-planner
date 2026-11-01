import { MapPinPlus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useTranslation } from '@/shared/i18n';
import type { Cluster } from '../types';

const title = (c: Cluster) => { const s = c.stops[0]; return `#${s.no} ${s.name ?? `${s.street} ${s.number}`}`; };

/**
 * Fixed route: tonight's stops that are on no route yet. The planner put each where it adds the least detour; the
 * driver checks each one (tap: move it). Delivered, it joins the route where it was taken.
 */
export function FreshStops({ clusters, nextIndex, onMove }: { clusters: Cluster[]; nextIndex: number; onMove(c: { cluster: Cluster; index: number }): void }) {
  const { t } = useTranslation();
  const fresh = clusters.map((cluster, index) => ({ cluster, index })).filter(({ cluster, index }) => index >= nextIndex && cluster.stops.some(s => s.fresh && !s.done));
  if (!fresh.length) return null;
  return (
    <Card className="border-express/40 py-3">
      <CardContent className="gap-2 px-4">
        <View className="flex-row items-center gap-2">
          <Icon as={MapPinPlus} size={18} className="text-express-ink" />
          <Text className="flex-1 font-bold">{t('route.freshTitle', { count: fresh.length })}</Text>
        </View>
        <Text className="text-muted-foreground text-sm">{t('route.freshBody')}</Text>
        {fresh.map(f => (
          <Pressable key={f.cluster.stops[0].key ?? f.index} onPress={() => onMove(f)} accessibilityRole="button" className="active:opacity-60 flex-row items-center gap-2 py-1">
            <Text className="flex-1 text-base font-semibold" numberOfLines={1}>{title(f.cluster)}</Text>
            <Text className="text-muted-foreground text-sm" numberOfLines={1}>
              {f.index > 0 ? t('route.freshAfter', { stop: title(clusters[f.index - 1]) }) : t('route.freshFirst')}
            </Text>
            <Text className="text-primary text-sm font-semibold">{t('route.freshMove')}</Text>
          </Pressable>
        ))}
      </CardContent>
    </Card>
  );
}

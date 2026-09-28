import { CircleCheck, Footprints, Navigation } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useTranslation } from '@/shared/i18n';
import { clock } from '../selectors';
import type { Cluster, Stop } from '../types';
import { StopBadges } from './StopBadges';
import { WalkStopRow } from './WalkStopRow';

/** The one card that matters while driving: where to go, and "done". Driver-sized buttons. */
export function NextStopCard({ cluster, index, total, startedAt, navLabel, onNavigate, onDelivered, onToggleStop }: {
  cluster: Cluster; index: number; total: number; startedAt: number; navLabel: string;
  onNavigate(): void; onDelivered(): void; onToggleStop(s: Stop): void;
}) {
  const { t } = useTranslation();
  const [first, ...walk] = cluster.stops;
  return (
    <Animated.View key={first.key} entering={FadeInRight.springify().damping(18)}>
      <Card className="border-primary/30 gap-0 border-2 py-5">
        <CardContent className="gap-4 px-5">
          <View className="flex-row items-center justify-between">
            <Text className="text-primary text-xs font-bold uppercase tracking-widest">{t('route.nextStopOf', { index: index + 1, total })}</Text>
            <Text className="text-muted-foreground text-sm font-semibold">{t('route.arriveApprox', { time: clock(startedAt, cluster.eta) })}</Text>
          </View>
          <View className="flex-row items-center gap-4">
            <View className="bg-foreground min-w-16 items-center rounded-lg px-3 py-2" accessibilityLabel={t('route.loadingNumberLabel', { n: first.no })}>
              <Text className="text-background text-3xl font-extrabold" style={{ fontVariant: ['tabular-nums'] }}>{first.no}</Text>
            </View>
            <View className="flex-1 gap-1">
              <Text className="text-2xl font-extrabold leading-7 tracking-tight">{first.street} {first.number}</Text>
              <Text className="text-muted-foreground" numberOfLines={1}>{[first.postcode, first.name].filter(Boolean).join(' · ')}</Text>
            </View>
          </View>
          <StopBadges stop={first} />
          {walk.length > 0 && (
            <View className="bg-muted gap-1 rounded-lg p-3">
              <View className="flex-row items-center gap-2">
                <Icon as={Footprints} size={16} className="text-muted-foreground" />
                <Text className="text-muted-foreground text-sm font-semibold">{t('route.parkOnceWalk')}</Text>
              </View>
              {walk.map(s => <WalkStopRow key={s.key} stop={s} onToggle={onToggleStop} />)}
            </View>
          )}
          <View className="gap-2.5">
            <Button size="xl" onPress={onNavigate}>
              <Icon as={Navigation} size={20} className="text-primary-foreground" />
              <Text>{t('route.navigateWith', { app: navLabel })}</Text>
            </Button>
            <Button size="xl" variant="success" onPress={onDelivered}>
              <Icon as={CircleCheck} size={20} className="text-success-foreground" />
              <Text>{walk.length ? t('route.allDeliveredCount', { n: cluster.stops.length }) : t('common.delivered')}</Text>
            </Button>
          </View>
        </CardContent>
      </Card>
    </Animated.View>
  );
}

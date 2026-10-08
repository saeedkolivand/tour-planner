import { Check, CircleCheck, Navigation, RotateCcw } from 'lucide-react-native';
import { memo } from 'react';
import { useTranslation } from '@/shared/i18n';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { SwipeRow } from '@/components/SwipeRow';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { clock } from '../selectors';
import type { Cluster } from '../types';

/**
 * A later (or finished) parking stop: order, address, loading numbers, ETA, quick actions.
 * Swipe right: Delivered (a full swipe does it). Swipe left: Navigate, or Undo on a delivered one.
 * In the Route list, hold to drag it elsewhere (`onLongPress`) or tap to move it to a position (`onPress`).
 */
export const ClusterRow = memo(function ClusterRow({ cluster, index, startedAt, done, onNavigate, onToggle, onPress, onLongPress }: {
  cluster: Cluster; index: number; startedAt: number; done?: boolean; onNavigate(c: Cluster): void; onToggle(c: Cluster): void;
  onPress?(c: Cluster): void; onLongPress?(): void;
}) {
  const { t } = useTranslation();
  const first = cluster.stops[0];
  const nos = cluster.stops.map(s => `#${s.no}`).join(' ');
  const eta = clock(startedAt, cluster.eta);
  // the tightest deadline here: Express, or a Paketshop's closing time; red when the plan arrives after it
  const due = cluster.stops.flatMap(s => [s.express, s.opens?.split('-')[1]]).filter(Boolean).sort()[0];
  const express = cluster.stops.map(s => s.express).filter(Boolean).sort()[0];
  const prio = cluster.stops.some(s => s.prio && s.express === express);
  const names = cluster.stops.map(s => s.name).filter(Boolean).join(' · ');
  const shop = cluster.stops.find(s => s.opens)?.opens;
  const late = !done && !!due && eta > due;
  return (
    <Animated.View entering={FadeIn} layout={LinearTransition.springify().damping(20)}>
    <SwipeRow commit="left"
      left={done ? [] : [{ label: t('common.delivered'), icon: CircleCheck, tone: 'success', onPress: () => onToggle(cluster) }]}
      right={done ? [{ label: t('common.undo'), icon: RotateCcw, tone: 'muted', onPress: () => onToggle(cluster) }]
        : [{ label: t('common.navigate'), icon: Navigation, tone: 'primary', onPress: () => onNavigate(cluster) }]}>
    <Pressable disabled={!onPress && !onLongPress} onPress={() => onPress?.(cluster)} onLongPress={onLongPress} delayLongPress={350}
      accessibilityHint={onPress ? t('route.moveHint') : undefined}
      className={cn('bg-card border-border flex-row items-center gap-3 rounded-lg border p-3', done && 'opacity-50')}>
      <View className={cn('size-9 items-center justify-center rounded-full', done ? 'bg-success/15' : 'bg-muted')}>
        {done ? <Icon as={Check} size={18} className="text-success-ink" />
          : <Text className="text-sm font-bold" style={{ fontVariant: ['tabular-nums'] }}>{index + 1}</Text>}
      </View>
      <View className="flex-1 gap-0.5">
        <Text className={cn('font-semibold', done && 'line-through')} numberOfLines={2}>
          {first.street} {first.number}{cluster.stops.length > 1 ? <Text className="text-muted-foreground">{`  +${cluster.stops.length - 1}`}</Text> : null}
        </Text>
        {!!names && <Text className="text-muted-foreground text-sm" numberOfLines={1}>{names}</Text>}
        <Text className="text-muted-foreground text-xs" style={{ fontVariant: ['tabular-nums'] }} numberOfLines={2}>
          {nos}{done ? '' : <Text className={cn('text-xs', late ? 'text-destructive font-semibold' : 'text-muted-foreground')}>{` · ~${eta}`}</Text>}
          {!done && !!express && <Text className="text-express-ink text-xs font-semibold">{` · ${prio ? 'PRIO' : t('common.expressValue', { value: express })}`}</Text>}
          {!done && !!first.slot && <Text className="text-muted-foreground text-xs">{` · ${first.slot.replace('-', '–')}`}</Text>}
          {!done && !!shop && <Text className="text-success-ink text-xs">{` · ${t('common.shopHours', { time: shop.replace(/:00/g, '').replace('-', '‑') })}`}</Text>}
        </Text>
      </View>
      {!done && (
        <Button variant="ghost" size="icon" onPress={() => onNavigate(cluster)} accessibilityLabel={t('route.navigateToAddress', { address: `${first.street} ${first.number}` })}>
          <Icon as={Navigation} size={18} className="text-primary" />
        </Button>
      )}
      <Button variant="ghost" size="icon" onPress={() => onToggle(cluster)} accessibilityLabel={done ? t('route.markNotDelivered') : t('route.markDelivered')}>
        <Icon as={done ? RotateCcw : Check} size={18} className={done ? 'text-muted-foreground' : 'text-success-ink'} />
      </Button>
    </Pressable>
    </SwipeRow>
    </Animated.View>
  );
});

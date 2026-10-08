import { Minus, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { haptic } from '@/shared/haptics';
import { useTranslation } from '@/shared/i18n';
import type { Cluster } from '../types';

/**
 * "Move to position N", the scanner's way: for a jump across a long list, where dragging would mean scrolling.
 * Positions are 1-based among the stops still to go (`first` .. `last`), as the Route list numbers them.
 */
export function MoveDialog({ cluster, at, first, last, onMove, onClose }: {
  cluster: Cluster; at: number; first: number; last: number; onMove(to: number): void; onClose(): void;
}) {
  const { t } = useTranslation();
  const [to, setTo] = useState(at);
  const step = (d: number) => { haptic.select(); setTo(n => Math.min(last, Math.max(first, n + d))); };
  const move = (n: number) => { haptic.tap(); if (n !== at) onMove(n); onClose(); };
  const s = cluster.stops[0];
  return (
    <Sheet title={t('route.moveTitle', { address: `${s.street} ${s.number}`.trim() })} onDismiss={onClose}
      cancel={{ label: t('common.cancel'), onPress: onClose }} action={{ label: t('common.done'), onPress: () => move(to) }}>
      <View className="flex-row items-center justify-center gap-4">
        <Button variant="outline" size="icon" onPress={() => step(-1)} disabled={to <= first} accessibilityLabel={t('route.moveEarlier')}>
          <Icon as={Minus} size={18} />
        </Button>
        <Text className="min-w-16 text-center text-3xl font-bold" style={{ fontVariant: ['tabular-nums'] }}>{to}</Text>
        <Button variant="outline" size="icon" onPress={() => step(1)} disabled={to >= last} accessibilityLabel={t('route.moveLater')}>
          <Icon as={Plus} size={18} />
        </Button>
      </View>
      <View className="flex-row gap-2">
        <Button variant="secondary" className="flex-1" onPress={() => move(first)}><Text>{t('route.moveNext')}</Text></Button>
        <Button variant="secondary" className="flex-1" onPress={() => move(last)}><Text>{t('route.moveLast')}</Text></Button>
      </View>
      <Button size="lg" onPress={() => move(to)}><Text>{t('route.moveBtn', { n: to })}</Text></Button>
    </Sheet>
  );
}

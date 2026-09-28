import { ChevronRight, PackagePlus, Pencil, Trash2 } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { SwipeRow } from '@/components/SwipeRow';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { haptic } from '@/shared/haptics';
import type { Stop } from '../types';
import { StopBadges } from './StopBadges';
import { StopTypeIcon } from './StopTypeIcon';
import { useTranslation } from '@/shared/i18n';

/** One captured stop. Tap to edit. Swipe left: Edit / Delete; swipe right: one more parcel (a full swipe adds it). */
export const StopListItem = memo(function StopListItem({ stop, index, onOpen, onDelete, onMoreParcels }: {
  stop: Stop; index: number; onOpen(i: number): void; onDelete(i: number): void; onMoreParcels(i: number): void;
}) {
  const { t } = useTranslation();
  const address = `${stop.street} ${stop.number}`.trim() || t('stops.newStop');
  const detail = [stop.postcode, stop.name, stop.type !== 'private' && t(`stopType.${stop.type}`)].filter(Boolean).join(' · ');
  return (
    <Animated.View entering={FadeInDown.duration(250).delay(Math.min(index, 8) * 30)} layout={LinearTransition}>
      <SwipeRow commit="left"
        left={[{ label: t('stops.addParcel'), icon: PackagePlus, tone: 'primary', onPress: () => onMoreParcels(index) }]}
        right={[{ label: t('common.edit'), icon: Pencil, tone: 'muted', onPress: () => onOpen(index) }, { label: t('common.delete'), icon: Trash2, tone: 'destructive', onPress: () => onDelete(index) }]}>
      <Pressable onPress={() => { haptic.tap(); onOpen(index); }}
        className="bg-card border-border active:bg-muted flex-row items-center gap-3 rounded-lg border px-3 py-3"
        accessibilityRole="button" accessibilityLabel={`${address}. ${detail}`} accessibilityHint={t('stops.openHint')}>
        <StopTypeIcon type={stop.type} />
        <View className="flex-1 gap-1">
          <Text className="text-base font-semibold" numberOfLines={1}>{address}</Text>
          {!!detail && <Text className="text-muted-foreground text-sm" numberOfLines={1}>{detail}</Text>}
          <StopBadges stop={stop} />
        </View>
        {stop.no != null && <Text className="text-muted-foreground font-bold" style={{ fontVariant: ['tabular-nums'] }}>#{stop.no}</Text>}
        <Icon as={ChevronRight} size={18} className="text-muted-foreground" />
      </Pressable>
      </SwipeRow>
    </Animated.View>
  );
});

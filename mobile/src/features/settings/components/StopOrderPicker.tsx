import { ListOrdered, Sparkles, WandSparkles } from 'lucide-react-native';
import { View } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { StopOrder } from '@/features/tour/types';
import { haptic } from '@/shared/haptics';
import { useTranslation } from '@/shared/i18n';

export const ORDER_TEXT = {
  improved: { label: 'settings.orderImproved', footer: 'settings.orderImprovedFooter' },
  fastest: { label: 'settings.orderFastest', footer: 'settings.orderFastestFooter' },
  scanned: { label: 'settings.orderScanned', footer: 'settings.orderScannedFooter' },
} as const;
const ORDERS = [{ key: 'improved', icon: WandSparkles }, { key: 'fastest', icon: Sparkles }, { key: 'scanned', icon: ListOrdered }] as const;

/** Improved (the scanner's order, local detours fixed), Fastest (the planner's own order) or As scanned (nothing re-ordered). */
export function StopOrderPicker({ value, onChange }: { value: StopOrder; onChange(v: StopOrder): void }) {
  const { t } = useTranslation();
  return (
    <ToggleGroup type="single" variant="outline" value={value} className="w-full"
      onValueChange={v => { if (v) { haptic.select(); onChange(v as StopOrder); } }}>
      {ORDERS.map((o, i) => (
        <ToggleGroupItem key={o.key} value={o.key} isFirst={i === 0} isLast={i === ORDERS.length - 1} className="h-14 flex-1" accessibilityLabel={t(ORDER_TEXT[o.key].label)}>
          <View className="flex-row items-center gap-1.5">
            <Icon as={o.icon} size={16} />
            <Text className="text-sm" numberOfLines={1}>{t(ORDER_TEXT[o.key].label)}</Text>
          </View>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

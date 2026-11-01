import { ListOrdered, MapPinned, Sparkles, WandSparkles } from 'lucide-react-native';
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
  route: { label: 'settings.orderRoute', footer: 'settings.orderRouteFooter' },
} as const;
const ORDERS = [{ key: 'improved', icon: WandSparkles }, { key: 'fastest', icon: Sparkles }, { key: 'scanned', icon: ListOrdered }, { key: 'route', icon: MapPinned }] as const;

/** Improved (the scanner's order, local detours fixed), Fastest (the planner's own order), As scanned (nothing re-ordered)
 * or Fixed route (the route's order, customers/fixedRoute.ts). */
export function StopOrderPicker({ value, onChange, withRoute }: { value: StopOrder; onChange(v: StopOrder): void; withRoute?: boolean }) {
  const { t } = useTranslation();
  // the fixed route only once one is on the phone (route.json imported)
  const orders = ORDERS.filter(o => o.key !== 'route' || withRoute || value === 'route');
  return (
    <ToggleGroup type="single" variant="outline" value={value} className="w-full"
      onValueChange={v => { if (v) { haptic.select(); onChange(v as StopOrder); } }}>
      {orders.map((o, i) => (
        <ToggleGroupItem key={o.key} value={o.key} isFirst={i === 0} isLast={i === orders.length - 1} className="h-14 flex-1" accessibilityLabel={t(ORDER_TEXT[o.key].label)}>
          <View className="flex-row items-center gap-1.5">
            <Icon as={o.icon} size={16} />
            <Text className="text-sm" numberOfLines={1}>{t(ORDER_TEXT[o.key].label)}</Text>
          </View>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

import { ListOrdered, Sparkles } from 'lucide-react-native';
import { View } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { StopOrder } from '@/features/tour/types';
import { haptic } from '@/shared/haptics';
import { useTranslation } from '@/shared/i18n';

const ORDERS = [{ key: 'fastest', icon: Sparkles, label: 'settings.orderFastest' }, { key: 'scanned', icon: ListOrdered, label: 'settings.orderScanned' }] as const;

/** Fastest (the planner's order) or As scanned (the scanner list's order, nothing re-ordered). */
export function StopOrderPicker({ value, onChange }: { value: StopOrder; onChange(v: StopOrder): void }) {
  const { t } = useTranslation();
  return (
    <ToggleGroup type="single" variant="outline" value={value} className="w-full"
      onValueChange={v => { if (v) { haptic.select(); onChange(v as StopOrder); } }}>
      {ORDERS.map((o, i) => (
        <ToggleGroupItem key={o.key} value={o.key} isFirst={i === 0} isLast={i === ORDERS.length - 1} className="h-14 flex-1" accessibilityLabel={t(o.label)}>
          <View className="flex-row items-center gap-2">
            <Icon as={o.icon} size={18} />
            <Text className="text-sm" numberOfLines={1}>{t(o.label)}</Text>
          </View>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

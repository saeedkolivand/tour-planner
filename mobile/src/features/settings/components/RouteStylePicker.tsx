import { Car, Footprints } from 'lucide-react-native';
import { View } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { haptic } from '@/shared/haptics';
import { useTranslation } from '@/shared/i18n';
import type { RouteStyle } from '../settings';

const STYLES = [{ key: 'walk', icon: Footprints, label: 'settings.styleWalk' }, { key: 'drive', icon: Car, label: 'settings.styleDrive' }] as const;

/** Park & walk (stops nearby share a parking spot) or door to door (drive up to nearly every stop). */
export function RouteStylePicker({ value, onChange }: { value: RouteStyle; onChange(v: RouteStyle): void }) {
  const { t } = useTranslation();
  return (
    <ToggleGroup type="single" variant="outline" value={value} className="w-full"
      onValueChange={v => { if (v) { haptic.select(); onChange(v as RouteStyle); } }}>
      {STYLES.map((s, i) => (
        <ToggleGroupItem key={s.key} value={s.key} isFirst={i === 0} isLast={i === STYLES.length - 1} className="h-14 flex-1" accessibilityLabel={t(s.label)}>
          <View className="flex-row items-center gap-2">
            <Icon as={s.icon} size={18} />
            <Text className="text-sm" numberOfLines={1}>{t(s.label)}</Text>
          </View>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

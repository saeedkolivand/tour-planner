import { View } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { haptic } from '@/shared/haptics';
import { useTranslation } from '@/shared/i18n';
import { STOP_TYPES, type StopType } from '../types';
import { TYPE_ICON } from './StopTypeIcon';

/** Four big segments with icons: easier to hit than a dropdown. */
export function TypePicker({ value, onChange }: { value: StopType; onChange(t: StopType): void }) {
  const { t } = useTranslation();
  return (
    <ToggleGroup type="single" variant="outline" value={value}
      onValueChange={v => { if (v) { haptic.select(); onChange(v as StopType); } }} className="w-full">
      {STOP_TYPES.map((type, i) => (
        <ToggleGroupItem key={type} value={type} isFirst={i === 0} isLast={i === STOP_TYPES.length - 1}
          className="h-16 flex-1" accessibilityLabel={t(`stopType.${type}`)}>
          <View className="items-center gap-1">
            <Icon as={TYPE_ICON[type]} size={18} />
            <Text className="text-xs">{t(`stopType.${type}`)}</Text>
          </View>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

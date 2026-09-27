import { View } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { haptic } from '@/shared/haptics';
import { STOP_TYPES, TYPE_LABEL, type StopType } from '../types';
import { TYPE_ICON } from './StopTypeIcon';

/** Four big segments with icons: easier to hit than a dropdown. */
export function TypePicker({ value, onChange }: { value: StopType; onChange(t: StopType): void }) {
  return (
    <ToggleGroup type="single" variant="outline" value={value}
      onValueChange={v => { if (v) { haptic.select(); onChange(v as StopType); } }} className="w-full">
      {STOP_TYPES.map((t, i) => (
        <ToggleGroupItem key={t} value={t} isFirst={i === 0} isLast={i === STOP_TYPES.length - 1}
          className="h-16 flex-1" accessibilityLabel={TYPE_LABEL[t]}>
          <View className="items-center gap-1">
            <Icon as={TYPE_ICON[t]} size={18} />
            <Text className="text-xs">{TYPE_LABEL[t]}</Text>
          </View>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

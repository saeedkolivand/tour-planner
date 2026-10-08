import { Check } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { haptic } from '@/shared/haptics';
import type { Stop } from '../types';

/** A stop reached on foot from the parking spot; tick it off on its own. */
export function WalkStopRow({ stop, onToggle }: { stop: Stop; onToggle(s: Stop): void }) {
  return (
    <Pressable onPress={() => { haptic.select(); onToggle(stop); }} className="flex-row items-center gap-3 py-1.5"
      accessibilityRole="checkbox" accessibilityState={{ checked: !!stop.done }} accessibilityLabel={`${stop.street} ${stop.number}, loading number ${stop.no}`}>
      <View className={cn('size-7 items-center justify-center rounded-full border-2', stop.done ? 'border-success bg-success' : 'border-border')}>
        {stop.done && <Icon as={Check} size={16} className="text-success-foreground" />}
      </View>
      <Text className="text-muted-foreground w-9 font-bold" style={{ fontVariant: ['tabular-nums'] }}>#{stop.no}</Text>
      <Text className={cn('flex-1 font-medium', stop.done && 'text-muted-foreground line-through')} numberOfLines={1}>
        {stop.street} {stop.number}{!!stop.name && <Text className="text-muted-foreground text-sm font-normal">{`  ${stop.name}`}</Text>}
      </Text>
    </Pressable>
  );
}

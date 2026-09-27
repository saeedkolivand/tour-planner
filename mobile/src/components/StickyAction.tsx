import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

/** The screen's main action, pinned above the tab bar within thumb reach. */
export function StickyAction({ label, icon, onPress, disabled }: { label: string; icon: LucideIcon; onPress(): void; disabled?: boolean }) {
  return (
    <Animated.View entering={FadeInDown.springify().damping(18)} className="absolute inset-x-0 bottom-0 px-5 pb-4">
      <View className="bg-background/80 rounded-2xl p-1.5">
        <Button size="xl" onPress={onPress} disabled={disabled} className="shadow-lg shadow-black/20">
          <Icon as={icon} size={20} className="text-primary-foreground" />
          <Text>{label}</Text>
        </Button>
      </View>
    </Animated.View>
  );
}

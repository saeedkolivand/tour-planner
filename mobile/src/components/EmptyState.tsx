import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

/** Friendly placeholder that says what to do next, never just "nothing here". */
export function EmptyState({ icon, title, body, action }: { icon: LucideIcon; title: string; body: string; action?: ReactNode }) {
  return (
    <Animated.View entering={FadeIn.duration(400)} className="items-center gap-3 px-8 py-12">
      <View className="bg-accent mb-1 size-20 items-center justify-center rounded-full">
        <Icon as={icon} size={36} className="text-accent-foreground" />
      </View>
      <Text className="text-center text-xl font-bold">{title}</Text>
      <Text className="text-muted-foreground text-center leading-6">{body}</Text>
      {action ? <View className="mt-2 w-full">{action}</View> : null}
    </Animated.View>
  );
}

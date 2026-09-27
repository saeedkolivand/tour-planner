import type { LucideIcon } from 'lucide-react-native';
import { useRef, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import ReanimatedSwipeable, { SwipeDirection, type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { haptic } from '@/shared/haptics';

export interface SwipeAction { label: string; icon: LucideIcon; tone: 'success' | 'destructive' | 'primary' | 'muted'; onPress(): void }

const TONE = { success: 'bg-success', destructive: 'bg-destructive', primary: 'bg-primary', muted: 'bg-secondary' } as const;
const WIDTH = 84;

/**
 * iOS-Mail-style row: swipe to reveal actions; tap one to run it. `commit` sides run their only action on a
 * full swipe (the thumb gesture you use one-handed at the van door), no second tap needed.
 * Swipe right shows `left` actions, swipe left shows `right` ones.
 */
export function SwipeRow({ left = [], right = [], commit, children }: {
  left?: SwipeAction[]; right?: SwipeAction[]; commit?: 'left' | 'right'; children: ReactNode;
}) {
  const ref = useRef<SwipeableMethods>(null);
  const panel = (actions: SwipeAction[]) => function SwipeActions() {
    return (
    <View className="flex-row">
      {actions.map(a => (
        <Pressable key={a.label} onPress={() => { ref.current?.close(); a.onPress(); }} accessibilityRole="button" accessibilityLabel={a.label}
          className={cn('items-center justify-center gap-1 rounded-lg', TONE[a.tone])} style={{ width: WIDTH, marginHorizontal: 3 }}>
          <Icon as={a.icon} size={22} className={a.tone === 'muted' ? 'text-foreground' : 'text-white'} />
          <Text className={cn('text-xs font-bold', a.tone === 'muted' ? 'text-foreground' : 'text-white')}>{a.label}</Text>
        </Pressable>
      ))}
    </View>
    );
  };
  // a committing side opens only when dragged well past its button, then runs it and springs back
  const far = WIDTH * 1.4;

  return (
    <ReanimatedSwipeable ref={ref} friction={1.2} overshootFriction={1}
      leftThreshold={commit === 'left' ? far : WIDTH / 2} rightThreshold={commit === 'right' ? far : WIDTH / 2}
      overshootLeft={commit === 'left'} overshootRight={commit === 'right'}
      renderLeftActions={left.length ? panel(left) : undefined} renderRightActions={right.length ? panel(right) : undefined}
      onSwipeableWillOpen={() => haptic.select()}
      onSwipeableOpen={dir => {
        // RIGHT = the row moved right, i.e. the left actions are showing
        const side = dir === SwipeDirection.RIGHT ? 'left' : 'right';
        const actions = side === 'left' ? left : right;
        if (commit === side && actions.length === 1) { ref.current?.close(); actions[0].onPress(); }
      }}>
      {children}
    </ReanimatedSwipeable>
  );
}

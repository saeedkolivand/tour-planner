import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

type BarButton = { label: string; onPress(): void; disabled?: boolean };

function Bar({ b, bold }: { b?: BarButton; bold?: boolean }) {
  return (
    <View className={cn('min-w-20', bold ? 'items-end' : 'items-start')}>
      {b && (
        <Pressable onPress={b.onPress} disabled={b.disabled} accessibilityRole="button" hitSlop={8} className="min-h-11 justify-center active:opacity-60">
          <Text className={cn('text-primary text-[17px]', bold && 'font-semibold', b.disabled && 'opacity-40')}>{b.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

/**
 * The iOS sheet for a task: slides up over the screen (a page sheet on iPhone, swiped down to close), a bar with
 * Cancel on the left, the title in the middle and the confirming action on the right (Apple HIG: Sheets).
 * `onDismiss`: a swipe down or the Android back button.
 */
export function Sheet({ title, cancel, action, onDismiss, children }: {
  title: string; cancel: BarButton; action?: BarButton; onDismiss(): void; children: ReactNode;
}) {
  const { top, bottom } = useSafeAreaInsets();
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onDismiss}>
      {/* the iPhone page sheet sits below the status bar by itself; Android's modal is full screen */}
      <View className="bg-background flex-1" style={{ paddingTop: Platform.OS === 'ios' ? 0 : top }}>
        <View className="border-border h-14 flex-row items-center gap-2 border-b px-4">
          <Bar b={cancel} />
          <Text className="flex-1 text-center text-[17px] font-semibold" numberOfLines={1} role="heading">{title}</Text>
          <Bar b={action} bold />
        </View>
        <ScrollView contentContainerClassName="gap-5 p-5" contentContainerStyle={{ paddingBottom: bottom + 20 }}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

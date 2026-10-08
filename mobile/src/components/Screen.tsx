import type { ReactNode } from 'react';
import { cantReachPc } from '@/features/tour/store';
import { useTranslation, type Key } from '@/shared/i18n';
import { ArrowLeft, ChevronLeft } from 'lucide-react-native';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/**
 * Large-title screen header, laid out as iOS does (Apple HIG: Navigation bars; Android's top app bar the same way): a bar
 * row with the way back on the left (`back`, the previous screen's name) and the screen's actions on the right
 * (`right`), the large title under it.
 */
export function ScreenHeader({ title, subtitle, right, back }: { title: string; subtitle?: string; right?: ReactNode; back?: { label: string; onPress(): void } }) {
  const { top } = useSafeAreaInsets();
  const bar = !!(back || right);
  return (
    <View className="px-5 pb-3" style={{ paddingTop: top + (bar ? 4 : 12) }}>
      {bar && (
        <View className="min-h-11 flex-row items-center justify-between">
          {back ? (
            <Pressable onPress={back.onPress} accessibilityRole="button" accessibilityLabel={back.label} hitSlop={8}
              className="-ml-1.5 min-h-11 min-w-11 flex-row items-center active:opacity-60">
              {/* iOS: "‹ Settings"; Android (Material top app bar): the arrow alone */}
              {Platform.OS === 'android' ? <Icon as={ArrowLeft} size={24} className="text-foreground" />
                : <><Icon as={ChevronLeft} size={26} className="text-primary" /><Text className="text-primary text-[17px]">{back.label}</Text></>}
            </Pressable>
          ) : <View />}
          {right}
        </View>
      )}
      <View className="gap-0.5">
        {!!subtitle && <Text className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">{subtitle}</Text>}
        <Text className="text-[34px] font-extrabold leading-[40px] tracking-tight" role="heading">{title}</Text>
      </View>
    </View>
  );
}

/**
 * One line under the header: a spinner with what's running (`busy` is a translation key) and, when known, how far
 * (3 / 12 with a bar); else the last error, or that the PC is out of reach.
 */
export function StatusBanner({ busy, progress, error, offline }: {
  busy: string | null; progress?: { done: number; total: number } | null; error: string | null; offline?: boolean;
}) {
  const { t } = useTranslation();
  if (!busy && !error && !offline) return null;
  const step = busy && progress?.total ? progress : null;
  return (
    <View className={cn('mx-5 mb-2 gap-2 rounded-lg px-3 py-2', error && !busy ? 'bg-destructive/10' : 'bg-muted')}
      accessibilityLiveRegion="polite">
      <View className="flex-row items-center gap-2">
        {busy ? <ActivityIndicator size="small" /> : null}
        <Text className={cn('flex-1 text-sm', error && !busy ? 'text-destructive font-medium' : 'text-muted-foreground')}>
          {busy ? t(busy as Key) : error ? (cantReachPc(error) ? t('store.cantReachPc') : error) : t('common.offlineBanner')}
        </Text>
        {step && <Text className="text-muted-foreground text-sm font-semibold" style={{ fontVariant: ['tabular-nums'] }}>{step.done} / {step.total}</Text>}
      </View>
      {step && <Progress value={(step.done / step.total) * 100} className="h-1.5" aria-label={t(busy as Key)} />}
    </View>
  );
}

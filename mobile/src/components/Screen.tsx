import type { ReactNode } from 'react';
import { cantReachPc } from '@/features/tour/store';
import { useTranslation, type Key } from '@/shared/i18n';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/** Large-title screen header (iOS style) with an optional trailing action. */
export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const { top } = useSafeAreaInsets();
  return (
    <View className="flex-row items-end justify-between px-5 pb-3" style={{ paddingTop: top + 12 }}>
      <View className="flex-1 gap-0.5">
        {!!subtitle && <Text className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">{subtitle}</Text>}
        <Text className="text-[34px] font-extrabold leading-[40px] tracking-tight" role="heading">{title}</Text>
      </View>
      {right}
    </View>
  );
}

/** One line under the header: a spinner with what's running (`busy` is a translation key), the last error, or that the PC is out of reach. */
export function StatusBanner({ busy, error, offline }: { busy: string | null; error: string | null; offline?: boolean }) {
  const { t } = useTranslation();
  if (!busy && !error && !offline) return null;
  return (
    <View className={cn('mx-5 mb-2 flex-row items-center gap-2 rounded-lg px-3 py-2', error && !busy ? 'bg-destructive/10' : 'bg-muted')}
      accessibilityLiveRegion="polite">
      {busy ? <ActivityIndicator size="small" /> : null}
      <Text className={cn('flex-1 text-sm', error && !busy ? 'text-destructive font-medium' : 'text-muted-foreground')}>
        {busy ? t(busy as Key) : error ? (cantReachPc(error) ? t('store.cantReachPc') : error) : t('common.offlineBanner')}
      </Text>
    </View>
  );
}

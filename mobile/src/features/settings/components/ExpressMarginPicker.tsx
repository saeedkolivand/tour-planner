import { Text } from '@/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { haptic } from '@/shared/haptics';
import { useTranslation } from '@/shared/i18n';

const MINUTES = [0, 5, 10, 15, 20] as const;

/** How many minutes before an Express deadline the plan aims to arrive. Bare numbers: five segments, the unit is in the row's title. */
export function ExpressMarginPicker({ value, onChange }: { value: number; onChange(min: number): void }) {
  const { t } = useTranslation();
  return (
    <ToggleGroup type="single" variant="outline" value={String(value)} className="w-full"
      onValueChange={v => { if (v) { haptic.select(); onChange(Number(v)); } }}>
      {MINUTES.map((m, i) => (
        <ToggleGroupItem key={m} value={String(m)} isFirst={i === 0} isLast={i === MINUTES.length - 1} className="h-12 flex-1"
          accessibilityLabel={m ? t('settings.marginMinutesA11y', { n: m }) : t('settings.marginNone')}>
          <Text className="text-sm" style={{ fontVariant: ['tabular-nums'] }} numberOfLines={1}>{m}</Text>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

import { Text } from '@/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { haptic } from '@/shared/haptics';
import { useTranslation } from '@/shared/i18n';
import type { Settings } from '../settings';

const OPTIONS = ['system', 'en', 'de'] as const;

/** System / English / Deutsch. Switches the whole app's language right away. */
export function LanguagePicker({ value, onChange }: { value: Settings['language']; onChange(v: Settings['language']): void }) {
  const { t } = useTranslation();
  const label: Record<(typeof OPTIONS)[number], string> = { system: t('settings.langSystem'), en: t('settings.langEnglish'), de: t('settings.langGerman') };
  return (
    <ToggleGroup type="single" variant="outline" value={value} className="w-full"
      onValueChange={v => { if (v) { haptic.select(); onChange(v as Settings['language']); } }}>
      {OPTIONS.map((o, i) => (
        <ToggleGroupItem key={o} value={o} isFirst={i === 0} isLast={i === OPTIONS.length - 1} className="h-12 flex-1" accessibilityLabel={label[o]}>
          <Text className="text-sm" numberOfLines={1}>{label[o]}</Text>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

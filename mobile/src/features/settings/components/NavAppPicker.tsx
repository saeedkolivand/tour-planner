import { Text } from '@/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { NAV_APPS, type NavApp } from '@/services/navigation';
import { haptic } from '@/shared/haptics';

const APPS = Object.keys(NAV_APPS) as NavApp[];
const SHORT: Record<NavApp, string> = { apple: 'Apple', google: 'Google', waze: 'Waze' };

/** Which app "Navigate" opens. It's the app you'll see on the CarPlay screen. */
export function NavAppPicker({ value, onChange }: { value: NavApp; onChange(a: NavApp): void }) {
  return (
    <ToggleGroup type="single" variant="outline" value={value} className="w-full"
      onValueChange={v => { if (v) { haptic.select(); onChange(v as NavApp); } }}>
      {APPS.map((a, i) => (
        <ToggleGroupItem key={a} value={a} isFirst={i === 0} isLast={i === APPS.length - 1} className="h-12 flex-1" accessibilityLabel={NAV_APPS[a]}>
          <Text className="text-sm" numberOfLines={1}>{SHORT[a]}</Text>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

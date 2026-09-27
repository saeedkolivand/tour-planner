import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { haptic } from '@/shared/haptics';

/** An iOS-style grouped section: caption, rounded card, optional footnote. */
export function SettingsSection({ title, footer, children }: { title: string; footer?: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-muted-foreground px-1 text-xs font-bold uppercase tracking-widest">{title}</Text>
      <View className="bg-card border-border gap-3 rounded-xl border p-4">{children}</View>
      {!!footer && <Text className="text-muted-foreground px-1 text-xs leading-5">{footer}</Text>}
    </View>
  );
}

export function SwitchRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange(v: boolean): void }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="flex-1 gap-0.5">
        <Text className="font-medium">{label}</Text>
        {!!hint && <Text className="text-muted-foreground text-sm">{hint}</Text>}
      </View>
      <Switch checked={value} onCheckedChange={v => { haptic.select(); onChange(v); }} accessibilityLabel={label} />
    </View>
  );
}

export { Separator as SettingsDivider };

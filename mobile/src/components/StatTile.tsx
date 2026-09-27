import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/** A number with a label. Tabular digits so values don't shift as they change. */
export function StatTile({ icon, value, label, tone = 'default' }: { icon: LucideIcon; value: string; label: string; tone?: 'default' | 'success' }) {
  return (
    <View className="bg-card border-border flex-1 gap-1.5 rounded-lg border p-3" accessible accessibilityLabel={`${label}: ${value}`}>
      <Icon as={icon} size={16} className={tone === 'success' ? 'text-success' : 'text-muted-foreground'} />
      <Text className={cn('text-xl font-bold tracking-tight', tone === 'success' && 'text-success')} style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      <Text className="text-muted-foreground text-xs font-medium">{label}</Text>
    </View>
  );
}

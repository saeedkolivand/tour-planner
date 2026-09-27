import { Building2, Home, PackageOpen, Store, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { StopType } from '../types';

export const TYPE_ICON: Record<StopType, LucideIcon> = { private: Home, business: Building2, pickup: PackageOpen, shop: Store };

/** Rounded tile with the stop type's icon; tinted when the stop is done. */
export function StopTypeIcon({ type, done, className }: { type: StopType; done?: boolean; className?: string }) {
  return (
    <View className={cn('size-11 items-center justify-center rounded-md', done ? 'bg-success/15' : 'bg-muted', className)}>
      <Icon as={TYPE_ICON[type]} size={20} className={done ? 'text-success' : 'text-foreground'} />
    </View>
  );
}

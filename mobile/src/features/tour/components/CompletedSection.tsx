import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { haptic } from '@/shared/haptics';
import type { Cluster } from '../types';
import { ClusterRow } from './ClusterRow';

/** Delivered parking stops, collapsed by default so the list stays about what's left. */
export function CompletedSection({ items, startedAt, onReopen }: {
  items: { cluster: Cluster; index: number }[]; startedAt: number; onReopen(c: Cluster): void;
}) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <View className="mt-4 gap-2.5">
      <Pressable onPress={() => { haptic.select(); setOpen(o => !o); }} className="flex-row items-center gap-1.5 py-1"
        accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Icon as={open ? ChevronDown : ChevronRight} size={16} className="text-muted-foreground" />
        <Text className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Delivered ({items.length})</Text>
      </Pressable>
      {open && items.map(({ cluster, index }) => (
        <ClusterRow key={cluster.stops[0].key ?? index} cluster={cluster} index={index} startedAt={startedAt} done onNavigate={() => {}} onToggle={onReopen} />
      ))}
    </View>
  );
}

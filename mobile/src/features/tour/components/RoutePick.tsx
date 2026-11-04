import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { sameName } from '@/features/customers/fixedRoute';
import { bare } from '@/features/planner/stops';
import { useTranslation } from '@/shared/i18n';
import type { Stop } from '../types';

/**
 * Which stop on the fixed route a row is, picked by the driver when the name and the address both failed: the route's
 * stops whose name is near first, any by typing. Picked, the route stop parks it at its pin, tonight and later.
 */
export function RoutePick({ stop, route, onPick }: { stop: Stop; route: { id: string; name: string; rank: number }[]; onPick(id: string): void }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const hits = q.trim() ? route.filter(r => bare(r.name).includes(bare(q.trim()))) : route.filter(r => sameName(r.name, stop.name, stop.street));
  return (
    <View className="gap-2">
      <Label>{t('stops.routePickTitle')}</Label>
      <Input onChangeText={setQ} placeholder={t('stops.routePickSearch')} accessibilityLabel={t('stops.routePickSearch')} returnKeyType="search" />
      {hits.slice(0, 6).map(r => (
        <Pressable key={r.id} onPress={() => onPick(r.id)} accessibilityRole="button" accessibilityLabel={t('stops.routePickItem', { name: r.name })}
          className="bg-card border-border min-h-12 flex-row items-center gap-3 rounded-xl border px-3 active:opacity-70">
          <Text className="text-muted-foreground w-8 font-semibold" style={{ fontVariant: ['tabular-nums'] }}>{Number.isInteger(r.rank) ? r.rank : '+'}</Text>
          <Text className="flex-1 text-[17px]" numberOfLines={1}>{r.name}</Text>
        </Pressable>
      ))}
      <Text className="text-muted-foreground text-xs">{t('stops.routePickHint')}</Text>
    </View>
  );
}

import { Clock, MapPin, Route, Sparkles } from 'lucide-react-native';
import { View } from 'react-native';
import { StatTile } from '@/components/StatTile';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { duration, type RouteView } from '../selectors';
import type { Plan } from '../types';

/** Distance, time and savings, then how far through the tour you are. */
export function RouteStats({ plan, view }: { plan: Plan; view: RouteView }) {
  const pct = view.total ? (view.delivered / view.total) * 100 : 0;
  return (
    <View className="gap-3">
      <View className="flex-row gap-2.5">
        <StatTile icon={Route} value={`${plan.km.toFixed(1)} km`} label="Distance" />
        <StatTile icon={Clock} value={duration(plan.min)} label="Est. time" />
        {view.savedMin > 0
          ? <StatTile icon={Sparkles} value={duration(view.savedMin)} label="time saved" tone="success" />
          : <StatTile icon={MapPin} value={String(view.upcoming.length + (view.next ? 1 : 0))} label="Parking stops" />}
      </View>
      <View className="gap-2">
        <View className="flex-row justify-between">
          <Text className="text-sm font-semibold">Delivered</Text>
          <Text className="text-muted-foreground text-sm font-semibold" style={{ fontVariant: ['tabular-nums'] }}>{view.delivered} / {view.total}</Text>
        </View>
        <Progress value={pct} className="bg-success/15 h-2.5" indicatorClassName="bg-success" aria-label="Delivery progress" />
      </View>
      {plan.by?.startsWith('phone') && (
        <Text className="text-muted-foreground text-xs">
          {plan.by === 'phone-road' ? 'Planned on this phone with road times.' : `Planned on this phone: times are estimated from distance${plan.note ? ` (${plan.note})` : ''}.`} Roadworks and closures are only known to your PC.
        </Text>
      )}
    </View>
  );
}

// Settings overview: Past deliveries, then each group with its current values; a tap opens the group's page.
import { router } from 'expo-router';
import { ChevronRight, History, type LucideIcon } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { ScreenHeader, StatusBanner } from '@/components/Screen';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { GROUPS } from '@/features/settings/groups';
import { useSettings } from '@/features/settings/settings';
import { useTourState } from '@/features/tour/TourProvider';
import { haptic } from '@/shared/haptics';
import { useTranslation } from '@/shared/i18n';

function Row({ icon, title, summary, onPress }: { icon: LucideIcon; title: string; summary?: string; onPress(): void }) {
  return (
    <Pressable onPress={() => { haptic.select(); onPress(); }} accessibilityRole="button" accessibilityLabel={title} accessibilityHint={summary}
      className="bg-card border-border flex-row items-center gap-3 rounded-xl border px-4 py-3.5 active:opacity-70">
      <View className="bg-primary/10 size-9 items-center justify-center rounded-lg"><Icon as={icon} size={18} className="text-primary" /></View>
      <View className="flex-1 gap-0.5">
        <Text className="font-semibold">{title}</Text>
        {!!summary && <Text className="text-muted-foreground text-sm" numberOfLines={1}>{summary}</Text>}
      </View>
      <Icon as={ChevronRight} size={18} className="text-muted-foreground" />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const s = useSettings();
  const { busy, progress, error, offline } = useTourState();
  return (
    <View className="bg-background flex-1">
      <ScreenHeader title={t('tabs.settings')} />
      <StatusBanner busy={busy} progress={progress} error={error} offline={offline} />
      <ScrollView contentContainerClassName="gap-3 px-5 pb-16">
        <Row icon={History} title={t('history.open')} onPress={() => router.push('/history')} />
        <View className="h-2" />
        {GROUPS.map(g => (
          <Row key={g.id} icon={g.icon} title={t(`settingsGroups.${g.id}`)} summary={g.summary(s, t)}
            onPress={() => router.push({ pathname: '/settings/[group]', params: { group: g.id } })} />
        ))}
      </ScrollView>
    </View>
  );
}

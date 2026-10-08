// One settings group on its own page (src/features/settings/groups); its title is the row that opened it.
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { ScreenHeader, StatusBanner } from '@/components/Screen';
import { GROUPS } from '@/features/settings/groups';
import { useTourState } from '@/features/tour/TourProvider';
import { useTranslation } from '@/shared/i18n';

export default function SettingsGroupScreen() {
  const { t } = useTranslation();
  const { group } = useLocalSearchParams<{ group: string }>();
  const { busy, progress, error, offline } = useTourState();
  const g = GROUPS.find(x => x.id === group) ?? GROUPS[0];
  return (
    <View className="bg-background flex-1">
      <ScreenHeader title={t(`settingsGroups.${g.id}`)} back={{ label: t('tabs.settings'), onPress: () => router.back() }} />
      <StatusBanner busy={busy} progress={progress} error={error} offline={offline} />
      <ScrollView contentContainerClassName="gap-6 px-5 pb-16" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <g.Body />
      </ScrollView>
    </View>
  );
}

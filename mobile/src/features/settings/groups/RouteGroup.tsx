import { Platform, View } from 'react-native';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { NavAppPicker } from '@/features/settings/components/NavAppPicker';
import { RouteStylePicker } from '@/features/settings/components/RouteStylePicker';
import { SettingsDivider, SettingsSection, SwitchRow } from '@/features/settings/components/SettingsSection';
import { ORDER_TEXT, StopOrderPicker } from '@/features/settings/components/StopOrderPicker';
import { setSettings, useSettings } from '@/features/settings/settings';
import { useTranslation } from '@/shared/i18n';

/** Where the tour starts and ends, how the stops are ordered and driven, which app navigates. */
export function RouteGroup() {
  const { t } = useTranslation();
  const s = useSettings();
  return (
    <>
      <SettingsSection title={t('settings.startEnd')} footer={t('settings.startEndFooter')}>
        <Input defaultValue={s.depot} placeholder={t('settings.depotPlaceholder')} accessibilityLabel={t('settings.depotLabel')}
          onChangeText={depot => setSettings({ depot: depot.trim() })} />
        <SettingsDivider />
        <SwitchRow label={t('settings.returnToDepot')} hint={t('settings.returnToDepotHint')} value={s.endAtDepot} onChange={endAtDepot => setSettings({ endAtDepot })} />
        <SettingsDivider />
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1 gap-0.5">
            <Text className="font-medium">{t('settings.leaveAt')}</Text>
            <Text className="text-muted-foreground text-sm">{t('settings.leaveAtHint')}</Text>
          </View>
          <Input defaultValue={s.leaveAt} placeholder="08:30" keyboardType="numbers-and-punctuation" maxLength={5} className="w-24 text-center"
            accessibilityLabel={t('settings.leaveAtA11y')} onChangeText={leaveAt => setSettings({ leaveAt: leaveAt.trim() })} />
        </View>
      </SettingsSection>

      <SettingsSection title={t('settings.stopOrder')} footer={t(ORDER_TEXT[s.stopOrder].footer)}>
        <StopOrderPicker value={s.stopOrder} onChange={stopOrder => setSettings({ stopOrder })} />
      </SettingsSection>

      <SettingsSection title={t('settings.routeStyle')} footer={t('settings.routeStyleFooter')}>
        <RouteStylePicker value={s.routeStyle} onChange={routeStyle => setSettings({ routeStyle })} />
        <SettingsDivider />
        <SwitchRow label={t('settings.bothSides')} hint={s.bothSides ? t('settings.bothSidesOnHint') : t('settings.bothSidesOffHint')}
          value={s.bothSides} onChange={bothSides => setSettings({ bothSides })} />
      </SettingsSection>

      <SettingsSection title={Platform.OS === 'ios' ? t('settings.navCarPlay') : t('settings.navAndroidAuto')}
        footer={t('settings.navFooter', { screen: Platform.OS === 'ios' ? 'CarPlay' : 'Android Auto' })}>
        <NavAppPicker value={s.navApp} onChange={navApp => setSettings({ navApp })} />
        <SettingsDivider />
        <SwitchRow label={t('settings.autoNavigate')} hint={t('settings.autoNavigateHint')} value={s.autoNavigate} onChange={autoNavigate => setSettings({ autoNavigate })} />
      </SettingsSection>
    </>
  );
}

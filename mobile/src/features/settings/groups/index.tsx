// Settings, grouped: the Settings tab lists these; each opens its own page (src/app/settings/[group].tsx).
import { Bell, Database, Globe, Languages, Route, type LucideIcon } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { LanguagePicker } from '@/features/settings/components/LanguagePicker';
import { SettingsSection } from '@/features/settings/components/SettingsSection';
import { setSettings, useSettings, type Settings } from '@/features/settings/settings';
import { NAV_APPS } from '@/services/navigation';
import { UpdateSection } from '@/features/updates/UpdateSection';
import { useTranslation, type Translate } from '@/shared/i18n';
import { DataGroup } from './DataGroup';
import { ExpressGroup } from './ExpressGroup';
import { OnlineGroup } from './OnlineGroup';
import { RouteGroup } from './RouteGroup';

function AppGroup() {
  const { t } = useTranslation();
  const s = useSettings();
  return (
    <>
      <SettingsSection title={t('settings.language')}>
        <LanguagePicker value={s.language} onChange={language => setSettings({ language })} />
      </SettingsSection>
      <UpdateSection />
    </>
  );
}

export type GroupId = 'route' | 'express' | 'online' | 'data' | 'app';

const on = (...xs: (string | false)[]) => xs.filter(Boolean).join(' · ');

/**
 * Ordered as the platform guides say (Android settings patterns, Apple HIG lists): what a driver changes most on top,
 * one-time setup next, upkeep after, the app itself last. Each row shows its current values; its label is its page title.
 */
export const GROUPS: { id: GroupId; icon: LucideIcon; Body: ComponentType; summary(s: Settings, t: Translate): string }[] = [
  { id: 'route', icon: Route, Body: RouteGroup,
    summary: (s, t) => on(t(s.stopOrder === 'scanned' ? 'settings.orderScanned' : 'settings.orderFastest'), t(s.routeStyle === 'walk' ? 'settings.styleWalk' : 'settings.styleDrive'), NAV_APPS[s.navApp]) },
  { id: 'express', icon: Bell, Body: ExpressGroup,
    summary: (s, t) => on(s.expressOnTime && t('settings.expressOnTime'), s.expressAlerts && t('settings.expressAlerts'), s.arrivalAlerts && t('settings.arrivalAlerts')) || t('settingsGroups.allOff') },
  { id: 'online', icon: Globe, Body: OnlineGroup,
    summary: (s, t) => on(t(s.planner === 'phone' || !s.server.trim() ? 'settingsGroups.phoneOnly' : 'settingsGroups.withPc'), !!s.orsKey && 'OpenRouteService', !!s.geoapifyKey && 'Geoapify') },
  { id: 'data', icon: Database, Body: DataGroup,
    summary: (s, t) => on(t(s.keepHistory ? 'settingsGroups.historyOn' : 'settingsGroups.historyOff'), s.detailedLog && t('settings.detailedLog')) },
  { id: 'app', icon: Languages, Body: AppGroup,
    summary: (s, t) => t(s.language === 'de' ? 'settings.langGerman' : s.language === 'en' ? 'settings.langEnglish' : 'settings.langSystem') },
];

// Settings > Export log: one text file to send for a diagnosis. Line 1 describes the app and its settings, line 2
// is today's tour (stops and plan), then every kept log entry, oldest first, one JSON object per line.
import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { getSettings } from '@/features/settings/settings';
import type { Tour } from '@/features/tour/types';
import { t } from './i18n';
import { log } from './log';
import { readLogFile } from './logFile';

const L = log('log-export');

export async function exportLog(tour: Tour) {
  const s = getSettings();
  const header = {
    type: 'header', app: 'tour-planner', version: Constants.expoConfig?.version, os: Platform.OS, osVersion: String(Platform.Version),
    exportedAt: new Date().toISOString(),
    // no secrets in a file that gets sent around: the server address (tailnet name) and the ORS key are only "set"
    settings: { ...s, server: s.server ? '(set)' : '', orsKey: s.orsKey ? '(set)' : '' },
  };
  L.info('exporting', { stops: tour.stops.length, planned: !!tour.plan, detailed: s.detailedLog });
  const entries = readLogFile();
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const f = new File(Paths.cache, `tour-planner-log-${stamp}.txt`);
  if (f.exists) f.delete();
  f.create();
  f.write([JSON.stringify(header), JSON.stringify({ type: 'tour', ...tour }), entries].join('\n'));
  if (!(await Sharing.isAvailableAsync())) throw new Error(t('settings.exportUnavailable'));
  await Sharing.shareAsync(f.uri, { mimeType: 'text/plain', UTI: 'public.plain-text', dialogTitle: t('settings.exportLog') });
  return entries.split('\n').filter(Boolean).length;
}

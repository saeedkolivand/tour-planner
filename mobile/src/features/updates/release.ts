// The builds live only on GitHub Releases (see release.yml), so the app asks GitHub whether a newer one exists.
export const RELEASES = 'https://github.com/saeedkolivand/tour-planner/releases';
const LATEST = 'https://api.github.com/repos/saeedkolivand/tour-planner/releases/latest';

export interface Release { version: string; url: string; apk?: string; ipa?: string }

/** "1.2.0" vs "1.10.0": numeric, so 1.10 is newer than 1.2; a leading "v" is ignored. */
export function isNewer(candidate: string, current: string) {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(x => parseInt(x, 10) || 0);
  const [a, b] = [parse(candidate), parse(current)];
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return false;
}

/** GitHub's "latest release" JSON -> what the app needs. Exported for the test; has no I/O. */
export function parseRelease(json: { tag_name: string; html_url: string; assets?: { name: string; browser_download_url: string }[] }): Release {
  const asset = (ext: string) => json.assets?.find(a => a.name.endsWith(ext))?.browser_download_url;
  return { version: json.tag_name.replace(/^v/, ''), url: json.html_url, apk: asset('.apk'), ipa: asset('.ipa') };
}

/** The newest published release. Throws when GitHub can't be reached (offline, rate limit). */
export async function latestRelease(fetchFn: typeof fetch = fetch): Promise<Release> {
  const r = await fetchFn(LATEST, { headers: { accept: 'application/vnd.github+json' } });
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  return parseRelease(await r.json());
}

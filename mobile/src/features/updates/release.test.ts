import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isNewer, parseRelease } from './release.ts';

test('version comparison is numeric per part and ignores a leading v', () => {
  assert.equal(isNewer('v1.10.0', '1.2.0'), true);
  assert.equal(isNewer('1.2.0', '1.2.0'), false);
  assert.equal(isNewer('1.2.0', '1.2.1'), false);
  assert.equal(isNewer('2.0.0', '1.99.99'), true);
});

test('the release JSON yields version, page and the two sideload files', () => {
  const r = parseRelease({
    tag_name: 'v1.3.0', html_url: 'https://example.test/r/v1.3.0',
    assets: [{ name: 'TourPlanner.apk', browser_download_url: 'https://example.test/a.apk' }, { name: 'TourPlanner-unsigned.ipa', browser_download_url: 'https://example.test/a.ipa' }],
  });
  assert.deepEqual(r, { version: '1.3.0', url: 'https://example.test/r/v1.3.0', apk: 'https://example.test/a.apk', ipa: 'https://example.test/a.ipa' });
  assert.equal(parseRelease({ tag_name: 'v1.0.0', html_url: 'u' }).apk, undefined);
});

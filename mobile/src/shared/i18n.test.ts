import assert from 'node:assert/strict';
import { test } from 'node:test';
import en from './locales/en.json' with { type: 'json' };
import de from './locales/de.json' with { type: 'json' };

type Tree = { [k: string]: string | Tree };
const leaves = (t: Tree, prefix = ''): [string, string][] =>
  Object.entries(t).flatMap(([k, v]) => typeof v === 'string' ? [[`${prefix}${k}`, v]] : leaves(v, `${prefix}${k}.`));

const enLeaves = leaves(en), deLeaves = leaves(de);
const placeholders = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]).sort();

test('en and de have exactly the same keys (recursively), none empty', () => {
  const enKeys = enLeaves.map(([k]) => k).sort();
  const deKeys = deLeaves.map(([k]) => k).sort();
  assert.deepEqual(enKeys, deKeys);
  for (const [k, v] of [...enLeaves, ...deLeaves]) assert.notEqual(v.trim(), '', `${k} is empty`);
});

test('every _one plural key has a matching _other, and vice versa', () => {
  const keys = new Set(enLeaves.map(([k]) => k));
  for (const k of keys) {
    if (k.endsWith('_one')) assert.ok(keys.has(`${k.slice(0, -4)}_other`), `${k} has no _other`);
    if (k.endsWith('_other')) assert.ok(keys.has(`${k.slice(0, -6)}_one`), `${k} has no _one`);
  }
});

test('German uses the same {{placeholders}} as English for every key', () => {
  const deByKey = new Map(deLeaves);
  for (const [k, v] of enLeaves) assert.deepEqual(placeholders(deByKey.get(k)!), placeholders(v), `placeholder mismatch for ${k}`);
});

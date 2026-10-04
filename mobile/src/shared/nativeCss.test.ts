/// <reference types="node" />
// The Android and iOS builds turn Tailwind's CSS into React Native styles (react-native-css-interop) and fail the
// whole release on one rule that doesn't parse. Tailwind reads anything in src/ shaped like an arbitrary property
// (square brackets around name, colon, value) as a class: a regex character class of dash, colon and T became a
// rule with no property name and broke v1.5.0's builds, while the web build, which keeps plain CSS, was fine.
// (Don't quote such a pattern here either: this file is in src/ too.) The same compile here takes a second.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);

test('the Tailwind CSS compiles for the native apps', async () => {
  const postcss = require('postcss');
  const tailwind = require('tailwindcss');
  const { cssToReactNativeRuntime } = require('react-native-css-interop/dist/css-to-rn');
  const { css } = await postcss([tailwind(require('../../tailwind.config.js'))]).process(fs.readFileSync('global.css', 'utf8'), { from: 'global.css' });
  assert.doesNotThrow(() => cssToReactNativeRuntime(css), 'a class name in src/ produced CSS the native builds cannot read');
});

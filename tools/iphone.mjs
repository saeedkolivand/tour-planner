#!/usr/bin/env node
// Drive the real iPhone through WebDriverAgent (WDA) on localhost:8100, from Windows, no Mac.
// mobile-mcp's own iOS agent needs a paid-account re-sign; WDA sideloaded with AltServer works, so this
// talks to it directly. Setup (once per session): see docs/iphone-automation.md.
//   node tools/iphone.mjs shot [file.png]         screenshot (default: shot.png)
//   node tools/iphone.mjs tree [filter]           visible elements: type, label, centre x,y (points)
//   node tools/iphone.mjs tap <x> <y> | tap "<label>"
//   node tools/iphone.mjs swipe <x1> <y1> <x2> <y2> [seconds]
//   node tools/iphone.mjs type "<text>" | clear ["<field label>"]   types into / empties a field
//   node tools/iphone.mjs launch [bundleId] | home | status
import fs from 'node:fs';

const WDA = process.env.WDA_URL || 'http://localhost:8100';
const [cmd, ...args] = process.argv.slice(2);

async function call(method, path, body) {
  const r = await fetch(WDA + path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.value?.error) throw new Error(`${method} ${path}: ${j.value?.message ?? r.status}`);
  return j;
}
let sid;
const session = async () => (sid ??= (await call('POST', '/session', { capabilities: { alwaysMatch: {} } })).sessionId);

/** Flatten the accessibility tree into visible, labelled elements. */
function flat(node, out = []) {
  const f = node.rect ?? {};
  const label = node.label || node.name || node.value;
  if (node.isVisible !== false && label && f.width > 0 && f.height > 0 && node.type !== 'Other')
    out.push({ type: node.type?.replace('XCUIElementType', ''), label: String(label).replace(/\s+/g, ' ').slice(0, 80), x: Math.round(f.x + f.width / 2), y: Math.round(f.y + f.height / 2), w: f.width, h: f.height });
  for (const c of node.children ?? []) flat(c, out);
  return out;
}
const elements = async () => flat((await call('GET', '/source?format=json')).value);

const run = {
  async status() { console.log((await call('GET', '/status')).value.message); },
  async shot([file = 'shot.png']) { fs.writeFileSync(file, Buffer.from((await call('GET', '/screenshot')).value, 'base64')); console.log(file); },
  async tree([filter]) {
    const seen = new Set(); // a label and its text node report the same thing twice
    for (const e of (await elements()).filter(e => !seen.has(`${e.label}|${e.x}|${e.y}`) && seen.add(`${e.label}|${e.x}|${e.y}`))) if (!filter || e.label.toLowerCase().includes(filter.toLowerCase())) console.log(`${e.type.padEnd(12)} ${e.x},${e.y}  ${e.label}`);
  },
  async tap([a, b]) {
    let x = Number(a), y = Number(b);
    if (Number.isNaN(x)) {
      const hit = (await elements()).find(e => e.label.toLowerCase() === a.toLowerCase()) ?? (await elements()).find(e => e.label.toLowerCase().includes(a.toLowerCase()));
      if (!hit) throw new Error(`no element labelled "${a}"`);
      ({ x, y } = hit);
    }
    await call('POST', `/session/${await session()}/wda/tap`, { x, y });
    console.log(`tapped ${x},${y}`);
  },
  async swipe([x1, y1, x2, y2, s = '0.3']) {
    await call('POST', `/session/${await session()}/wda/dragfromtoforduration`, { fromX: +x1, fromY: +y1, toX: +x2, toY: +y2, duration: +s });
    console.log('swiped');
  },
  // 8 keys/s: at WDA's default 60/s a React Native text field drops characters
  async type([text]) { await call('POST', `/session/${await session()}/wda/keys`, { value: [...text], frequency: 8 }); console.log('typed'); },
  async clear([label]) {
    const by = label ? { using: 'accessibility id', value: label } : { using: 'class chain', value: '**/*[`focused == 1`]' };
    const id = (await call('POST', `/session/${await session()}/element`, by)).value.ELEMENT;
    await call('POST', `/session/${await session()}/element/${id}/clear`);
    console.log('cleared');
  },
  // AltStore appends the team id to the bundle id it installs: set BUNDLE_ID=dev.saeed.tourplanner.<TEAMID> for a sideloaded build
  async launch([bundleId = process.env.BUNDLE_ID ?? 'dev.saeed.tourplanner']) { await call('POST', `/session/${await session()}/wda/apps/launch`, { bundleId }); console.log('launched', bundleId); },
  async home() { await call('POST', '/wda/homescreen'); console.log('home'); },
};

if (!run[cmd]) { console.log(fs.readFileSync(new URL(import.meta.url)).toString().split('\n').filter(l => l.startsWith('//   ')).join('\n')); process.exit(1); }
run[cmd](args).catch(e => { console.error(e.message); process.exit(1); });

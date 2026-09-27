// Entry point: JSON API from api.mjs, static web app from public/. Every request and error is logged.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { routes } from './api.mjs';
import { flushLogs, log } from './log.mjs';
import { startRoadJobs } from './roads/schedule.mjs';

const PORT = Number(process.env.PORT || 3000);
const MAX_BODY = 50 * 1024 * 1024; // a batch of phone photos as base64
const PUBLIC = new URL('../public/', import.meta.url);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const L = log('http');

async function readJson(req) {
  let raw = '';
  req.setEncoding('utf8'); // decode across chunks: a 'ü' split between two chunks became '��'
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY) throw Object.assign(new Error('request too large'), { status: 413 });
  }
  let body;
  try { body = raw ? JSON.parse(raw) : {}; }
  catch { throw Object.assign(new Error('body is not valid JSON'), { status: 400 }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw Object.assign(new Error('body must be a JSON object'), { status: 400 });
  return body;
}

function serveStatic(pathname, res) {
  const full = new URL('.' + path.posix.normalize(pathname === '/' ? '/index.html' : pathname), PUBLIC);
  if (!full.href.startsWith(PUBLIC.href) || !fs.statSync(full, { throwIfNoEntry: false })?.isFile()) return false;
  res.writeHead(200, { 'content-type': TYPES[path.extname(full.pathname)] || 'application/octet-stream' });
  res.end(fs.readFileSync(full));
  return true;
}

// Only the Expo web preview on this PC is a cross-origin caller (the phone app doesn't use CORS).
const DEV_ORIGIN = /^http:\/\/localhost:\d+$/;

const server = http.createServer(async (req, res) => {
  const t0 = performance.now();
  if (DEV_ORIGIN.test(req.headers.origin ?? '')) {
    res.setHeader('access-control-allow-origin', req.headers.origin);
    res.setHeader('access-control-allow-headers', 'content-type');
    res.setHeader('access-control-allow-methods', 'GET, POST, PUT');
    if (req.method === 'OPTIONS') return res.writeHead(204).end();
  }
  const { pathname, searchParams } = new URL(req.url, 'http://x');
  const handler = routes[`${req.method} ${pathname}`];
  const done = (status, extra = {}) => {
    if (pathname !== '/log') L[status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info']('request', { method: req.method, path: pathname, status, ms: Math.round(performance.now() - t0), ...extra });
  };

  if (!handler) {
    if (req.method === 'GET' && serveStatic(pathname, res)) return done(200);
    res.writeHead(404).end('not found');
    return done(404);
  }
  try {
    const out = await handler(await readJson(req), Object.fromEntries(searchParams));
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(out));
    done(200);
  } catch (e) {
    const status = e.status || 500;
    res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify({ error: e.message }));
    done(status, { error: e });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  L.info('listening', { port: PORT, vision: process.env.VISION || 'auto' });
  startRoadJobs();
});
process.on('uncaughtException', e => { L.error('uncaught exception', { error: e }); flushLogs(); process.exit(1); });
process.on('unhandledRejection', e => L.error('unhandled rejection', { error: e }));

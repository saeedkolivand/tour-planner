// Runs wsl/osrm.sh inside WSL, streaming its output into the logs.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { log } from '../log.mjs';

const L = log('osrm');
const SCRIPT = new URL('../../wsl/osrm.sh', import.meta.url);

/** C:\Users\x\file → /mnt/c/Users/x/file */
export const wslPath = url => fileURLToPath(url).replace(/^([A-Za-z]):\\/, (_, d) => `/mnt/${d.toLowerCase()}/`).replaceAll('\\', '/');

// osrm.sh checks the port inside WSL; Windows' localhost forwarding lags a moment behind a restart
async function reachable(ports = [5050, 5051], ms = 30_000) {
  const until = Date.now() + ms;
  for (const port of ports) {
    while (!(await fetch(`http://localhost:${port}/nearest/v1/driving/6.96,50.94`).then(r => r.ok, () => false))) {
      if (Date.now() > until) throw new Error(`osrm :${port} not reachable from Windows`);
      await new Promise(r => setTimeout(r, 250));
    }
  }
}

let queue = Promise.resolve(); // one osrm.sh at a time: each restarts osrm-routed

export function osrm(command, speedsUrl) {
  const run = () => new Promise((resolve, reject) => {
    const args = ['-d', 'Ubuntu', '--', 'bash', wslPath(SCRIPT), command, ...(speedsUrl ? [wslPath(speedsUrl)] : [])];
    const t0 = performance.now();
    const p = spawn('wsl', args, { windowsHide: true });
    const lines = [];
    const collect = level => buf => buf.toString().split(/\r?\n/).filter(Boolean).forEach(line => { lines.push(line); L[level](line, { command }); });
    p.stdout.on('data', collect('info'));
    p.stderr.on('data', collect('warn'));
    p.on('error', reject);
    p.on('close', code => {
      const ms = Math.round(performance.now() - t0);
      if (code === 0) reachable().then(() => { L.info(`${command} done`, { ms: Math.round(performance.now() - t0), scriptMs: ms }); resolve(lines); }, reject);
      else reject(new Error(`osrm.sh ${command} exited ${code}: ${lines.at(-1) ?? ''}`));
    });
  });
  const next = queue.then(run, run);
  queue = next.catch(() => {});
  return next;
}

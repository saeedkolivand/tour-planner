export type Level = 'debug' | 'info' | 'warn' | 'error';
export interface Entry { t: string; level: Level; scope: string; msg: string; [k: string]: unknown }

export interface LogQueueDeps {
  /** Sends a batch to the server; must throw on failure so the batch is kept. */
  send(entries: Entry[]): Promise<void>;
  /** Persists the unsent queue (so logs survive an app kill or a day offline). */
  persist(entries: Entry[]): Promise<void>;
  now?: () => Date;
}

const MAX = 5000; // ponytail: oldest dropped past this; a full day offline is well under it

/** Errors are not JSON-serialisable: an Error (as data, or as data.error) becomes top-level error + stack, like the server's logs. */
const errorFields = (v: unknown) => v instanceof Error ? { error: v.message, stack: v.stack } : {};
const serialisable = (data: Record<string, unknown> | Error) =>
  data instanceof Error ? errorFields(data) : { ...data, ...errorFields(data.error) };

/** A log buffer that is flushed in batches and never loses entries on a failed send. Framework-free. */
export function createLogQueue(deps: LogQueueDeps, initial: Entry[] = []) {
  let queue = initial.slice(-MAX);
  let flushing = false;
  const now = deps.now ?? (() => new Date());

  /** Queues one entry and returns it as it will be sent. */
  function add(level: Level, scope: string, msg: string, data: Record<string, unknown> | Error = {}): Entry {
    const e: Entry = { ...serialisable(data), t: now().toISOString(), level, scope, msg };
    queue.push(e);
    if (queue.length > MAX) queue = queue.slice(-MAX);
    deps.persist(queue).catch(() => {});
    return e;
  }

  async function flush() {
    if (flushing || !queue.length) return;
    flushing = true;
    const batch = queue.slice(0, 500);
    try {
      await deps.send(batch);
      queue = queue.slice(batch.length);
      await deps.persist(queue).catch(() => {});
    } catch { /* offline or server down: keep the batch, next flush retries */ }
    finally { flushing = false; }
  }

  return { add, flush, size: () => queue.length };
}

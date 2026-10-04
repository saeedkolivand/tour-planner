/** The slice of shared/log.ts's Logger the store needs; injected so the store stays framework-free. */
export interface StoreLogger {
  /** Only recorded while Settings > Detailed log is on. */
  debug(msg: string, data?: Record<string, unknown>): void;
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
}

/** Default for tests and anywhere logging isn't wanted. */
export const silent: StoreLogger = { debug() {}, info() {}, warn() {}, error() {} };

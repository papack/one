import type { LogLevelType, LogPortInterface } from "./types";

export interface NullLoggerOptionsInterface {}

// shared resolved Promise for max perf (no new Promise allocation on each call)
const resolvedPromise = Promise.resolve();

/**
 * Logger implementation that discards all log calls.
 * Implements the Null-Object pattern so the caller does not need to branch
 * or check whether logging is enabled.
 */
export class NullLogger implements LogPortInterface {
  public readonly loglevel: LogLevelType;

  constructor() {
    this.loglevel = "err";
  }

  trace(_source: string, _message: string): Promise<void> {
    void _source;
    void _message;
    return resolvedPromise;
  }

  info(_source: string, _message: string): Promise<void> {
    void _source;
    void _message;
    return resolvedPromise;
  }

  warn(_source: string, _message: string): Promise<void> {
    void _source;
    void _message;
    return resolvedPromise;
  }

  err(_source: string, _message: string): Promise<void> {
    void _source;
    void _message;
    return resolvedPromise;
  }
}

import os from "node:os";
import type { LogLevelType, LogPortInterface } from "./types";

export interface LoggerOptionsInterface {
  loglevel: LogLevelType;
}

const resolvedPromise = Promise.resolve();

export class Logger implements LogPortInterface {
  public readonly loglevel: LogLevelType;
  private hostname = os.hostname();
  private pid = typeof process !== "undefined" ? process.pid : undefined;

  constructor(args: LoggerOptionsInterface) {
    this.loglevel = args.loglevel;
  }

  private write(
    level: LogLevelType,
    source: string,
    message: string,
    color: string,
  ): void {
    if (
      (this.loglevel === "info" && level === "trace") ||
      (this.loglevel === "warn" && (level === "trace" || level === "info")) ||
      (this.loglevel === "err" && level !== "err")
    )
      return;

    const ts = new Date().toISOString();
    const lvl = `[${level.toUpperCase()}]`;

    let prefix = "";
    if (this.hostname && this.pid) prefix = `${this.hostname}(${this.pid})`;
    else if (this.hostname) prefix = this.hostname;
    else if (this.pid) prefix = `(${this.pid})`;

    const formatted = prefix
      ? `${ts} ${lvl} ${prefix}: ${source}: ${message}`
      : `${ts} ${lvl} ${source}: ${message}`;

    const colored = `${color}${formatted}\x1b[0m`;

    if (level === "warn") console.warn(colored);
    else if (level === "err") console.error(colored);
    else console.log(colored);
  }

  trace(s: string, m: string) {
    this.write("trace", s, m, "\x1b[90m");
    return resolvedPromise;
  }
  info(s: string, m: string) {
    this.write("info", s, m, "\x1b[37m");
    return resolvedPromise;
  }
  warn(s: string, m: string) {
    this.write("warn", s, m, "\x1b[33m");
    return resolvedPromise;
  }
  err(s: string, m: string) {
    this.write("err", s, m, "\x1b[31m");
    return resolvedPromise;
  }
}

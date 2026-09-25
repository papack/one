import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Logger } from "./logger";
import os from "node:os";

function mockConsole() {
  return {
    log: vi.fn<(...args: unknown[]) => void>(),
    warn: vi.fn<(...args: unknown[]) => void>(),
    error: vi.fn<(...args: unknown[]) => void>(),
  };
}

describe("Logger", () => {
  let logger: Logger;
  let c: ReturnType<typeof mockConsole>;
  const hostname = os.hostname();
  const pid = process.pid;

  beforeEach(() => {
    c = mockConsole();
    vi.spyOn(console, "log").mockImplementation(c.log);
    vi.spyOn(console, "warn").mockImplementation(c.warn);
    vi.spyOn(console, "error").mockImplementation(c.error);
    logger = new Logger({ loglevel: "trace" });
  });

  it("prints an info line to stdout with ANSI color + hostname + pid", async () => {
    await logger.info("main.ts", "server started");

    expect(c.log).toHaveBeenCalledTimes(1);
    const [output] = c.log.mock.calls[0];

    expect(output).toContain("[INFO]");
    expect(output).toContain("main.ts");
    expect(output).toContain("server started");
    expect(output).toContain(hostname);
    expect(output).toContain(`(${pid})`);
    expect(output).toContain("\x1b[37m"); // white ANSI
    expect(output).toContain("\x1b[0m"); // reset ANSI
  });

  it("prints warnings via console.warn", async () => {
    await logger.warn("api.ts", "latency high");

    expect(c.warn).toHaveBeenCalledTimes(1);
    const [output] = c.warn.mock.calls[0];

    expect(output).toContain("[WARN]");
    expect(output).toContain("api.ts");
    expect(output).toContain("latency high");
    expect(output).toContain("\x1b[33m");
  });

  it("prints errors via console.error", async () => {
    await logger.err("db.ts", "connection lost");

    expect(c.error).toHaveBeenCalledTimes(1);
    const [output] = c.error.mock.calls[0];

    expect(output).toContain("[ERR]");
    expect(output).toContain("db.ts");
    expect(output).toContain("connection lost");
    expect(output).toContain("\x1b[31m");
  });

  it("filters trace when loglevel is info", async () => {
    logger = new Logger({ loglevel: "info" });

    await logger.trace("x.ts", "hidden");

    expect(c.log).toHaveBeenCalledTimes(0);
    expect(c.warn).toHaveBeenCalledTimes(0);
    expect(c.error).toHaveBeenCalledTimes(0);
  });

  it("filters trace and info when loglevel is warn", async () => {
    logger = new Logger({ loglevel: "warn" });

    await logger.trace("x.ts", "hidden");
    await logger.info("x.ts", "hidden");

    expect(c.log).toHaveBeenCalledTimes(0);
    expect(c.warn).toHaveBeenCalledTimes(0);
    expect(c.error).toHaveBeenCalledTimes(0);
  });

  it("accepts only errors when loglevel is err", async () => {
    logger = new Logger({ loglevel: "err" });

    await logger.warn("fail.ts", "ignored");
    await logger.info("fail.ts", "ignored");
    await logger.trace("fail.ts", "ignored");
    await logger.err("fail.ts", "only this is logged");

    expect(c.error).toHaveBeenCalledTimes(1);
    expect(c.log).toHaveBeenCalledTimes(0);
    expect(c.warn).toHaveBeenCalledTimes(0);
  });
});

afterEach(() => vi.restoreAllMocks());

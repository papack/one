import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NullLogger } from "./null-logger";

describe("NullLogger", () => {
  let logger: NullLogger;
  let c: { log: any; warn: any; error: any };

  beforeEach(() => {
    c = {
      log: vi.fn(() => {}),
      warn: vi.fn(() => {}),
      error: vi.fn(() => {}),
    };
    vi.spyOn(console, "log").mockImplementation(c.log);
    vi.spyOn(console, "warn").mockImplementation(c.warn);
    vi.spyOn(console, "error").mockImplementation(c.error);

    logger = new NullLogger();
  });

  it("has loglevel 'err' by design", () => {
    expect(logger.loglevel).toBe("err");
  });

  it("returns the same resolved promise on all methods", async () => {
    const p1 = logger.trace("a.ts", "msg1");
    const p2 = logger.info("a.ts", "msg2");
    const p3 = logger.warn("a.ts", "msg3");
    const p4 = logger.err("a.ts", "msg4");

    expect(p1).toBe(p2);
    expect(p2).toBe(p3);
    expect(p3).toBe(p4);

    await p4; // resolves without throwing
  });

  it("produces no console output", async () => {
    await logger.trace("a.ts", "msg1");
    await logger.info("a.ts", "msg2");
    await logger.warn("a.ts", "msg3");
    await logger.err("a.ts", "msg4");

    expect(c.log).toHaveBeenCalledTimes(0);
    expect(c.warn).toHaveBeenCalledTimes(0);
    expect(c.error).toHaveBeenCalledTimes(0);
  });
});

afterEach(() => vi.restoreAllMocks());

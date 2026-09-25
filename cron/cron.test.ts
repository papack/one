import { afterEach, describe, expect, it, vi } from "vitest";
import { Cron } from "./index";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Cron integration", () => {
  it("runs on minute boundaries, supports repeated start, stop and restart", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:00:45Z"));
    const task = vi.fn();
    const cron = new Cron({ timezone: "UTC", onError: vi.fn() });
    cron.schedule("* * * * *", task);
    cron.start();
    cron.start();
    await vi.advanceTimersByTimeAsync(14_999);
    expect(task).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(task).toHaveBeenCalledTimes(1);
    cron.stop();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(task).toHaveBeenCalledTimes(1);
    cron.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(task).toHaveBeenCalledTimes(2);
    cron.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not recreate timers when stopped by the first task", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const cron = new Cron({ onError: vi.fn() });
    const task = vi.fn(() => cron.stop());
    cron.schedule("* * * * *", task);
    cron.start();
    await vi.advanceTimersByTimeAsync(180_000);
    expect(task).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("matches a configured timezone at midnight", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-12-31T22:59:00Z"));
    const task = vi.fn();
    const cron = new Cron({ timezone: "Europe/Berlin", onError: vi.fn() });
    cron.schedule("0 0 1 1 *", task);
    cron.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(task).toHaveBeenCalledOnce();
    cron.stop();
  });

  it.each([false, true])(
    "isolates failing error handlers (async: %s)",
    async (async) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      const logging = vi.spyOn(console, "error").mockImplementation(() => {});
      const onError = vi.fn(() => {
        if (async) return Promise.reject(new Error("handler"));
        throw new Error("handler");
      });
      const cron = new Cron({ onError });
      cron.schedule("* * * * *", () => {
        throw new Error("sync task");
      });
      cron.schedule("* * * * *", async () => {
        throw new Error("async task");
      });
      const healthy = vi.fn();
      cron.schedule("* * * * *", healthy);
      cron.start();
      await vi.advanceTimersByTimeAsync(120_000);
      expect(healthy).toHaveBeenCalledTimes(2);
      expect(onError).toHaveBeenCalledTimes(4);
      expect(logging).toHaveBeenCalledTimes(4);
      cron.stop();
    },
  );

  it("rejects invalid expressions before scheduling", () => {
    const cron = new Cron({ onError: vi.fn() });
    for (const expression of [
      "0x5 * * * *",
      "1e1 * * * *",
      "*/1e1 * * * *",
      "1-5 * * * *",
      "1,2 * * * *",
    ]) {
      expect(() => cron.schedule(expression, () => {})).toThrow();
    }
  });
});

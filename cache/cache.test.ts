import { afterEach, describe, expect, it, vi } from "vitest";
import { cache } from "./index";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

afterEach(() => vi.restoreAllMocks());

describe("cache", () => {
  it("loads lazily and caches indefinitely by default", async () => {
    const clock = vi.spyOn(performance, "now").mockReturnValue(0);
    const result = { value: 1 };
    const fn = vi.fn(async () => result);
    const [get] = cache(fn);
    expect(fn).not.toHaveBeenCalled();
    expect(await get()).toBe(result);
    clock.mockReturnValue(1e12);
    expect(await get()).toBe(result);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("refreshes lazily at the TTL boundary measured from completion", async () => {
    const clock = vi.spyOn(performance, "now").mockReturnValue(0);
    const pending = deferred<number>();
    const fn = vi
      .fn()
      .mockImplementationOnce(() => pending.promise)
      .mockResolvedValue(2);
    const [get] = cache(fn, 100);
    const first = get();
    await Promise.resolve();
    clock.mockReturnValue(500);
    expect(get()).toBe(first);
    pending.resolve(1);
    expect(await first).toBe(1);
    clock.mockReturnValue(599);
    expect(await get()).toBe(1);
    clock.mockReturnValue(600);
    expect(fn).toHaveBeenCalledOnce();
    const refresh = get();
    expect(get()).toBe(refresh);
    expect(await refresh).toBe(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("shares one load across 1,000 concurrent callers", async () => {
    const pending = deferred<number>();
    const fn = vi.fn(() => pending.promise);
    const [get] = cache(fn);
    const calls = Array.from({ length: 1_000 }, () => get());
    expect(new Set(calls).size).toBe(1);
    pending.resolve(42);
    expect((await Promise.all(calls)).every((value) => value === 42)).toBe(
      true,
    );
    expect(fn).toHaveBeenCalledOnce();
  });

  it("rejects all waiting callers on failure and shares a fresh retry", async () => {
    const failed = deferred<number>();
    const retry = deferred<number>();
    const error = new Error("load failed");
    const fn = vi
      .fn()
      .mockImplementationOnce(() => failed.promise)
      .mockImplementationOnce(() => retry.promise);
    const [get] = cache(fn);
    let settled = 0;
    const wait = () =>
      get().then(
        (value) => {
          settled++;
          return value;
        },
        (reason: unknown) => {
          settled++;
          throw reason;
        },
      );
    const firstWave = Promise.allSettled(Array.from({ length: 500 }, wait));
    await Promise.resolve();
    const lateWave = Promise.allSettled(Array.from({ length: 500 }, wait));
    await Promise.resolve();
    expect(fn).toHaveBeenCalledOnce();
    expect(settled).toBe(0);

    failed.reject(error);
    const failures = [...(await firstWave), ...(await lateWave)];
    expect(
      failures.every(
        (result) => result.status === "rejected" && result.reason === error,
      ),
    ).toBe(true);
    expect(settled).toBe(1_000);

    settled = 0;
    const retries = Promise.all(Array.from({ length: 1_000 }, wait));
    await Promise.resolve();
    expect(fn).toHaveBeenCalledTimes(2);
    expect(settled).toBe(0);
    retry.resolve(42);
    expect((await retries).every((value) => value === 42)).toBe(true);
    expect(settled).toBe(1_000);
    expect(await get()).toBe(42);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("clears a completed result and supports destructured methods", async () => {
    const fn = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    const [get, clear] = cache(fn);
    expect(await get()).toBe(1);
    clear();
    clear();
    expect(await get()).toBe(2);
  });

  it.each([false, true])(
    "ignores an invalidated pending load (reject: %s)",
    async (reject) => {
      const old = deferred<number>();
      const fn = vi
        .fn()
        .mockImplementationOnce(() => old.promise)
        .mockResolvedValue(2);
      const [get, clear] = cache(fn);
      const first = get();
      const observed = first.catch(() => "failed");
      await Promise.resolve();
      clear();
      expect(await get()).toBe(2);
      if (reject) old.reject(new Error("old load"));
      else old.resolve(1);
      expect(await observed).toBe(reject ? "failed" : 1);
      expect(await get()).toBe(2);
      expect(fn).toHaveBeenCalledTimes(2);
    },
  );

  it("retries failures, including synchronous throws", async () => {
    const error = new Error("load failed");
    const fn = vi
      .fn<() => Promise<number>>()
      .mockImplementationOnce(() => {
        throw error;
      })
      .mockRejectedValueOnce(error)
      .mockResolvedValue(3);
    const [get] = cache(fn);
    await expect(get()).rejects.toBe(error);
    await expect(get()).rejects.toBe(error);
    expect(await get()).toBe(3);
  });

  it("with zero TTL shares pending work but reloads completed results", async () => {
    const fn = vi.fn(async () => 1);
    const [get] = cache(fn, 0);
    const first = get();
    expect(get()).toBe(first);
    await first;
    await get();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it.each([undefined, null, false, 0, ""])(
    "caches falsy results (%s)",
    async (value) => {
      const fn = vi.fn(async () => value);
      const [get] = cache(fn);
      expect(await get()).toBe(value);
      expect(await get()).toBe(value);
      expect(fn).toHaveBeenCalledOnce();
    },
  );

  it.each([-1, -Infinity, NaN])("rejects invalid TTL %s", (ttl) => {
    expect(() => cache(async () => 1, ttl)).toThrow(RangeError);
  });
});

import { describe, expect, it, vi } from "vitest";
import { Bus } from "./bus";

type Events = { event: number };

describe("Bus", () => {
  it("starts listeners concurrently and waits for every listener", async () => {
    const bus = new Bus<Events>();
    let finishFirst!: () => void;
    let finishSecond!: () => void;
    const first = new Promise<void>((resolve) => {
      finishFirst = resolve;
    });
    const second = new Promise<void>((resolve) => {
      finishSecond = resolve;
    });
    const started = vi.fn();
    bus.on("event", () => {
      started("first");
      return first;
    });
    bus.on("event", () => {
      started("second");
      return second;
    });
    const completed = vi.fn();
    const emission = bus.emit("event", 7).then(completed);

    expect(started.mock.calls).toEqual([["first"], ["second"]]);
    await Promise.resolve();
    expect(completed).not.toHaveBeenCalled();
    finishSecond();
    await second;
    await Promise.resolve();
    expect(completed).not.toHaveBeenCalled();
    finishFirst();
    await emission;
    expect(completed).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it("waits for async error reporting", async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const onError = vi.fn(() => pending);
    const bus = new Bus<Events>(onError);
    bus.on("event", () => {
      throw new Error("failed");
    });
    const completed = vi.fn();
    const emission = bus.emit("event", 1).then(completed);
    await Promise.resolve();
    expect(onError).toHaveBeenCalledOnce();
    expect(completed).not.toHaveBeenCalled();
    finish();
    await emission;
    expect(completed).toHaveBeenCalledOnce();
  });

  it("isolates synchronous throws and async rejections", async () => {
    const onError = vi.fn();
    const bus = new Bus<Events>(onError);
    const sync = new Error("sync");
    const async = new Error("async");
    const syncId = bus.on("event", () => {
      throw sync;
    });
    const asyncId = bus.on("event", () => Promise.reject(async));
    const other = vi.fn();
    bus.on("event", other);
    await bus.emit("event", 1);

    expect(onError).toHaveBeenCalledWith(sync, "event", syncId);
    expect(onError).toHaveBeenCalledWith(async, "event", asyncId);
    expect(other).toHaveBeenCalledOnce();
  });

  it.each([false, true])(
    "contains error-handler failures (async: %s)",
    async (async) => {
      const logging = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const failure = new Error("reporting failed");
        const bus = new Bus<Events>(() => {
          if (async) return Promise.reject(failure);
          throw failure;
        });
        bus.on("event", () => {
          throw new Error("listener failed");
        });
        const other = vi.fn();
        bus.on("event", other);
        await bus.emit("event", 1);
        expect(other).toHaveBeenCalledOnce();
        expect(logging).toHaveBeenCalledOnce();
      } finally {
        logging.mockRestore();
      }
    },
  );

  it("consumes once listeners only once across nested emits", async () => {
    const bus = new Bus<Events>();
    bus.on("event", (value) => {
      if (value === 1) return bus.emit("event", 2);
    });
    const once = vi.fn(() => bus.emit("event", 3));
    bus.once("event", once);
    await bus.emit("event", 1);
    expect(once).toHaveBeenCalledExactlyOnceWith(2);
  });

  it("defers new registrations and skips removed listeners", async () => {
    const bus = new Bus<Events>();
    const added = vi.fn();
    const removed = vi.fn();
    let removedId: string;
    bus.once("event", () => {
      bus.on("event", added);
      bus.off(removedId);
    });
    removedId = bus.on("event", removed);
    await bus.emit("event", 1);
    expect(added).not.toHaveBeenCalled();
    expect(removed).not.toHaveBeenCalled();
    await bus.emit("event", 2);
    expect(added).toHaveBeenCalledExactlyOnceWith(2);
  });

  it("supports removing unused once listeners and emitting empty topics", async () => {
    const bus = new Bus<Events>();
    const callback = vi.fn();
    const id = bus.once("event", callback);
    bus.off(id);
    bus.off(id);
    await expect(bus.emit("event", 1)).resolves.toBeUndefined();
    expect(callback).not.toHaveBeenCalled();
    bus.on("event", callback);
    await bus.emit("event", 2);
    expect(callback).toHaveBeenCalledExactlyOnceWith(2);
  });
});

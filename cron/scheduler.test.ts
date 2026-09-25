// core/scheduler.test.ts

import { describe, it, expect } from "vitest";
import { Scheduler } from "./scheduler";
import { parse } from "./parser";

/* ===== Test implementations (local) ===== */

class FakeClock {
  constructor(private current: Date) {}

  now(): Date {
    return this.current;
  }

  set(date: Date) {
    this.current = date;
  }
}

class ManualTimer {
  private cb: (() => void) | null = null;

  start(onTick: () => void): void {
    this.cb = onTick;
  }

  stop(): void {
    this.cb = null;
  }

  tick(): void {
    this.cb?.();
  }
}

/* ===== Tests ===== */

describe("scheduler", () => {
  it("should run job on matching minute", () => {
    let ran = false;

    const jobs = [
      {
        expression: "5 10 * * *",
        parsed: parse("5 10 * * *"),
        task: () => {
          ran = true;
        },
      },
    ];

    const clock = new FakeClock(new Date(2024, 0, 1, 10, 5));
    const timer = new ManualTimer();

    const scheduler = new Scheduler(clock, timer, jobs, () => {});
    scheduler.start();

    timer.tick();

    expect(ran).toBe(true);
  });

  it("should not run twice in the same minute", () => {
    let count = 0;

    const jobs = [
      {
        expression: "* * * * *",
        parsed: parse("* * * * *"),
        task: () => {
          count++;
        },
      },
    ];

    const clock = new FakeClock(new Date(2024, 0, 1, 10, 0));
    const timer = new ManualTimer();

    const scheduler = new Scheduler(clock, timer, jobs, () => {});
    scheduler.start();

    timer.tick();
    timer.tick();
    timer.tick();

    expect(count).toBe(1);
  });

  it("should run again on next minute", () => {
    let count = 0;

    const jobs = [
      {
        expression: "* * * * *",
        parsed: parse("* * * * *"),
        task: () => {
          count++;
        },
      },
    ];

    const clock = new FakeClock(new Date(2024, 0, 1, 10, 0));
    const timer = new ManualTimer();

    const scheduler = new Scheduler(clock, timer, jobs, () => {});
    scheduler.start();

    timer.tick();

    clock.set(new Date(2024, 0, 1, 10, 1));
    timer.tick();

    expect(count).toBe(2);
  });

  it("should call onError when a sync task throws", () => {
    let errorCalled = false;

    const jobs = [
      {
        expression: "* * * * *",
        parsed: parse("* * * * *"),
        task: () => {
          throw new Error("boom");
        },
      },
    ];

    const clock = new FakeClock(new Date(2024, 0, 1, 10, 0));
    const timer = new ManualTimer();

    const scheduler = new Scheduler(clock, timer, jobs, () => {
      errorCalled = true;
    });

    scheduler.start();
    timer.tick();

    expect(errorCalled).toBe(true);
  });

  it("should call onError when an async task rejects", async () => {
    let errorCalled = false;

    const jobs = [
      {
        expression: "* * * * *",
        parsed: parse("* * * * *"),
        task: async () => {
          throw new Error("async boom");
        },
      },
    ];

    const clock = new FakeClock(new Date(2024, 0, 1, 10, 0));
    const timer = new ManualTimer();

    const scheduler = new Scheduler(clock, timer, jobs, () => {
      errorCalled = true;
    });

    scheduler.start();
    timer.tick();

    // allow promise rejection to propagate
    await Promise.resolve();

    expect(errorCalled).toBe(true);
  });
});

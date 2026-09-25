import { describe, it, expect } from "vitest";
import { SystemMinuteTimer } from "./timer";

describe("SystemMinuteTimer", () => {
  it("should start and stop without throwing", () => {
    const timer = new SystemMinuteTimer();

    expect(() => {
      timer.start(() => {});
      timer.stop();
    }).not.toThrow();
  });

  it("should not throw when stopped multiple times", () => {
    const timer = new SystemMinuteTimer();

    timer.start(() => {});
    timer.stop();
    timer.stop();

    expect(true).toBe(true);
  });

  it("should allow restart", () => {
    const timer = new SystemMinuteTimer();

    timer.start(() => {});
    timer.stop();
    timer.start(() => {});
    timer.stop();

    expect(true).toBe(true);
  });
});

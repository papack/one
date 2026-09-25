import { describe, it, expect, vi, afterEach } from "vitest";
import { SystemClock, TimezoneClock } from "./clock";

afterEach(() => vi.useRealTimers());

describe("clocks", () => {
  it("preserves the actual instant regardless of timezone", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    expect(new SystemClock().now().toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
    expect(new TimezoneClock("Europe/Berlin").now().toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });

  it("validates timezones at construction", () => {
    expect(() => new TimezoneClock("Invalid/Zone")).toThrow();
  });

  it("represents midnight as hour zero without changing the date", () => {
    expect(
      new TimezoneClock("UTC").fields(new Date("2026-01-01T00:00:00Z")),
    ).toEqual({
      minute: 0,
      hour: 0,
      day: 1,
      month: 1,
      weekday: 4,
    });
  });

  it("handles timezone date rollover", () => {
    expect(
      new TimezoneClock("America/New_York").fields(
        new Date("2026-01-01T00:00:00Z"),
      ),
    ).toEqual({
      minute: 0,
      hour: 19,
      day: 31,
      month: 12,
      weekday: 3,
    });
  });

  it("handles skipped and repeated wall-clock hours during DST", () => {
    const berlin = new TimezoneClock("Europe/Berlin");
    expect(berlin.fields(new Date("2026-03-29T00:30:00Z")).hour).toBe(1);
    expect(berlin.fields(new Date("2026-03-29T01:30:00Z")).hour).toBe(3);
    expect(berlin.fields(new Date("2026-10-25T00:30:00Z")).hour).toBe(2);
    expect(berlin.fields(new Date("2026-10-25T01:30:00Z")).hour).toBe(2);
  });
});

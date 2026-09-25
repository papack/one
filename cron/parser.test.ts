import { describe, it, expect } from "vitest";
import { parse } from "./parser";

describe("parser", () => {
  it("should parse wildcard fields", () => {
    const cron = parse("* * * * *");

    expect(cron.minute.size).toBe(60);
    expect(cron.hour.size).toBe(24);
    expect(cron.day.has(1)).toBe(true);
    expect(cron.month.has(12)).toBe(true);
    expect(cron.weekday.has(6)).toBe(true);
  });

  it("should parse single numbers", () => {
    const cron = parse("5 10 15 6 3");

    expect(cron.minute.has(5)).toBe(true);
    expect(cron.hour.has(10)).toBe(true);
    expect(cron.day.has(15)).toBe(true);
    expect(cron.month.has(6)).toBe(true);
    expect(cron.weekday.has(3)).toBe(true);
  });

  it("should parse step values", () => {
    const cron = parse("*/15 * * * *");

    expect(cron.minute.has(0)).toBe(true);
    expect(cron.minute.has(15)).toBe(true);
    expect(cron.minute.has(30)).toBe(true);
    expect(cron.minute.has(45)).toBe(true);
    expect(cron.minute.has(1)).toBe(false);
  });

  it("should throw on invalid field count", () => {
    expect(() => parse("* * * *")).toThrow();
    expect(() => parse("* * * * * *")).toThrow();
  });

  it("should throw on invalid values", () => {
    expect(() => parse("60 * * * *")).toThrow();
    expect(() => parse("*/0 * * * *")).toThrow();
    expect(() => parse("foo * * * *")).toThrow();
  });
});

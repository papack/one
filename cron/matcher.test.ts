import { describe, it, expect } from "vitest";
import { parse } from "./parser";
import { matches } from "./matcher";

describe("matcher", () => {
  it("should match exact date", () => {
    const cron = parse("5 10 15 6 6");
    const date = new Date(2024, 5, 15, 10, 5); // Sat Jun 15 2024 10:05

    expect(matches(cron, date)).toBe(true);
  });

  it("should not match wrong minute", () => {
    const cron = parse("5 * * * *");
    const date = new Date(2024, 0, 1, 0, 6);

    expect(matches(cron, date)).toBe(false);
  });

  it("should match wildcard cron", () => {
    const cron = parse("* * * * *");
    const date = new Date();

    expect(matches(cron, date)).toBe(true);
  });

  it("should match step values", () => {
    const cron = parse("*/15 * * * *");

    expect(matches(cron, new Date(2024, 0, 1, 0, 0))).toBe(true);
    expect(matches(cron, new Date(2024, 0, 1, 0, 15))).toBe(true);
    expect(matches(cron, new Date(2024, 0, 1, 0, 1))).toBe(false);
  });
});

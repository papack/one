import { afterEach, describe, expect, it, vi } from "vitest";
import { Logger, type LogLevelType } from "./index";

const levels: LogLevelType[] = ["trace", "info", "warn", "err"];
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Logger level filtering", () => {
  it.each(levels)(
    "applies the %s threshold to every level",
    async (loglevel) => {
      const output = vi.fn();
      vi.spyOn(console, "log").mockImplementation(output);
      vi.spyOn(console, "warn").mockImplementation(output);
      vi.spyOn(console, "error").mockImplementation(output);
      const logger = new Logger({ loglevel });
      for (const level of levels) {
        output.mockClear();
        await logger[level]("test", level);
        expect(output).toHaveBeenCalledTimes(
          levels.indexOf(level) >= levels.indexOf(loglevel) ? 1 : 0,
        );
      }
    },
  );
});

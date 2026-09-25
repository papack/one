import type { Clock } from "./clock";
import { matches } from "./matcher";
import type { ParsedCron } from "./parser";

export type CronClockPort = Clock;

export interface CronTimerPort {
  start(onTick: () => void): void;
  stop(): void;
}

export interface ScheduledJob {
  expression: string;
  parsed: ParsedCron;
  task: () => void | Promise<void>;
}

type OnError = (
  error: unknown,
  context: {
    expression: string;
    task: () => void | Promise<void>;
    date: Date;
  },
) => void | Promise<void>;

export class Scheduler {
  private lastMinuteKey: number | null = null;

  constructor(
    private readonly clock: CronClockPort,
    private readonly timer: CronTimerPort,
    private readonly jobs: ScheduledJob[],
    private readonly onError: OnError,
  ) {}

  start(): void {
    this.timer.start(() => this.tick());
  }

  stop(): void {
    this.timer.stop();
    this.lastMinuteKey = null;
  }

  private tick(): void {
    const now = this.clock.now();
    const minuteKey = Math.floor(now.getTime() / 60_000);

    if (this.lastMinuteKey === minuteKey) return;
    this.lastMinuteKey = minuteKey;

    const fields = this.clock.fields?.(now) ?? now;
    // Jobs registered by a task join the next tick.
    const jobs = this.jobs.slice();
    for (const job of jobs) {
      if (!matches(job.parsed, fields)) continue;

      try {
        void Promise.resolve(job.task()).catch((error: unknown) => {
          this.reportError(error, job, now);
        });
      } catch (error) {
        this.reportError(error, job, now);
      }
    }
  }

  private reportError(error: unknown, job: ScheduledJob, date: Date): void {
    const fallback = (handlerError: unknown) => {
      try {
        console.error("Cron error handler failed", {
          error,
          handlerError,
          expression: job.expression,
        });
      } catch {
        // Reporting must not interrupt other scheduled tasks.
      }
    };
    try {
      void Promise.resolve(
        this.onError(error, {
          expression: job.expression,
          task: job.task,
          date,
        }),
      ).catch(fallback);
    } catch (handlerError) {
      fallback(handlerError);
    }
  }
}

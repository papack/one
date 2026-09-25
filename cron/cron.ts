import { parse } from "./parser";
import { Scheduler } from "./scheduler";
import { SystemClock, TimezoneClock } from "./clock";
import { SystemMinuteTimer } from "./timer";

export type CronTask = () => void | Promise<void>;

export interface CronOptions {
  timezone?: string;
  onError: (
    error: unknown,
    context: {
      expression: string;
      task: CronTask;
      date: Date;
    },
  ) => void | Promise<void>;
}

export interface CronPortInterface {
  schedule(expression: string, task: CronTask): void;
  start(): void;
  stop(): void;
}

export class Cron implements CronPortInterface {
  private scheduler: Scheduler;
  private jobs: {
    expression: string;
    parsed: ReturnType<typeof parse>;
    task: CronTask;
  }[] = [];

  constructor(private readonly options: CronOptions) {
    const clock = options.timezone
      ? new TimezoneClock(options.timezone)
      : new SystemClock();

    const timer = new SystemMinuteTimer();

    this.scheduler = new Scheduler(clock, timer, this.jobs, options.onError);
  }

  schedule(expression: string, task: CronTask): void {
    const parsed = parse(expression);

    this.jobs.push({
      expression,
      parsed,
      task,
    });
  }

  start(): void {
    this.scheduler.start();
  }

  stop(): void {
    this.scheduler.stop();
  }
}

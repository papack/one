export interface CronTimer {
  start(onTick: () => void): void;
  stop(): void;
}

/** Realigns each tick to a minute boundary; missed minutes are not replayed. */
export class SystemMinuteTimer implements CronTimer {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;

  start(onTick: () => void): void {
    this.stop();
    const generation = this.generation;
    const schedule = () => {
      this.timeoutId = setTimeout(
        () => {
          this.timeoutId = null;
          try {
            onTick();
          } finally {
            // A task may stop or restart the timer during this tick.
            if (this.generation === generation) schedule();
          }
        },
        60_000 - (Date.now() % 60_000),
      );
    };
    schedule();
  }

  stop(): void {
    this.generation++;
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

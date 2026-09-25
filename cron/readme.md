# Cron

```ts
import { Cron } from "@papack/one/cron";

const cron = new Cron({
  timezone: "Europe/Berlin",
  onError(error, { expression, date }) {
    console.error("Cron task failed", { expression, date, error });
  },
});

cron.schedule("*/5 * * * *", async () => {
  await cleanUpExpiredSessions(); // Your application function
});
cron.start();
// On application shutdown:
// cron.stop();
```

`Cron`, `CronOptions`, `CronTask`, and `CronPortInterface` are also exported from
`@papack/one`. Importing the module does not start any timers.

## API and syntax

- `new Cron({ timezone?, onError })`: timezone defaults to the host's local time.
  Explicit IANA timezones are validated immediately. `onError` is required and
  may be async; it receives the error, expression, task, and actual execution date.
- `schedule(expression, task): void`: validate and register a sync or async task.
- `start(): void`: begin ticking at the next minute boundary. Repeated calls
  replace the existing timer rather than creating additional timers.
- `stop(): void`: stop future ticks. Already started tasks are not canceled or
  awaited, and registrations remain available for a later restart.

Five fields: `minute hour day-of-month month weekday`.
Ranges are 0–59, 0–23, 1–31, 1–12, and 0–6 (Sunday = 0), respectively.
Each field accepts `*`, a decimal integer, or `*/n` with a positive integer step,
starting at that field's minimum. Lists, ranges, names, seconds and aliases are
not supported. All five fields must match, including both day-of-month and
weekday; this is a limited syntax, not full Unix cron compatibility.

## Execution and limits

Matching tasks start in registration order without waiting for async completion.
Return or await async work inside the task so its errors reach `onError`.
Synchronous work still blocks the event loop. Slow tasks may overlap their next
scheduled run; concurrency limits and retries belong to the application.

Task errors go to `onError`. If that handler throws or rejects, the failure is
logged with `console.error` so other jobs can continue. A throwing handler is
not a supported process shutdown mechanism.

The timer realigns after each tick. Delayed/missed minutes are skipped, with no
catch-up or persistence. Jobs are local to this Cron instance; multiple server
instances each execute their own jobs. `stop()` during a tick stops future ticks,
but other matching jobs in the current snapshot may still start.

Timezone matching uses calendar fields independently of the host timezone.
The error context's `date` remains the actual instant. During daylight saving
transitions, nonexistent local minutes are skipped and repeated local minutes
can run twice (once for each real minute). Duplicate ticks in the same real
minute are suppressed while running. There is no exactly-once guarantee across
restarts or system clock adjustments.

## Integration changes

Compared with the upstream revision: cached and immediately validated timezone
formatters, explicit midnight handling, host-independent timezone matching,
strict decimal parsing, safe stop/restart from a task, timer realignment, job
snapshots, and isolated error-handler failures. Upstream tests were adapted from
Bun to Vitest and extended with integration regressions.

Run `npm test -- cron`.

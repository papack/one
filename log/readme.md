# Logging

```ts
import { Logger } from "@papack/one/log";

const log = new Logger({ loglevel: "info" });
await log.info("server", "Started");
await log.warn("chat", "Slow connection");
await log.err("chat", "Delivery failed");
```

The same exports are available from `@papack/one`. `Logger` uses Node's
hostname and process ID, ISO timestamps, and ANSI colors. Trace/info go to
`console.log`; warnings go to `console.warn` and errors to `console.error`.

To discard all output:

```ts
import { NullLogger } from "@papack/one/log";

const log = new NullLogger();
await log.err("chat", "Discarded");
```

`NullLogger` discards every message, even though its `loglevel` is `"err"`.

All adapters implement `LogPortInterface` with `trace(source, message)`,
`info(source, message)`, `warn(source, message)`, and `err(source, message)`.
Both arguments are strings; methods return `Promise<void>`. Minimum levels are
`trace < info < warn < err`. Messages below the configured level are ignored.
Options use `LoggerOptionsInterface`; log levels use `LogLevelType`.

## With Bus and Cron

```ts
import { Bus, Cron, Logger } from "@papack/one";

const log = new Logger({ loglevel: "info" });
const bus = new Bus<{ message: string }>((error, topic) =>
  log.err(`bus:${topic}`, String(error)),
);
const cron = new Cron({
  onError: (error, context) =>
    log.err(`cron:${context.expression}`, String(error)),
});
```

## Semantics and limits

Console output happens immediately; the returned promise is already resolved.
Awaiting it does not guarantee flushing, disk persistence, or delivery to a
remote collector. Console failures can throw synchronously. These adapters do
not add buffering, rotation, structured JSON output, redaction, or retries.
Avoid writing secrets and sanitize untrusted terminal control characters before
logging them. Heavy console output can affect application latency.

The Bun tests were adapted to Vitest with console spies restored after each
case. Additional tests cover all log-level combinations. Run `npm test -- log`.

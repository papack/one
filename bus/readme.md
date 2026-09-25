# Bus

An in-process, awaitable broadcast bus, available from `@papack/one`
and the browser-compatible `@papack/one/bus` entry point.

```ts
import { Bus } from "@papack/one/bus";

type Events = {
  "user:created": { id: string };
  "app:ready": undefined;
};

const bus = new Bus<Events>((error, topic, listenerId) => {
  console.error("Event failed", { error, topic, listenerId });
});

const id = bus.on("user:created", async (user) => {
  await saveAuditEntry(user.id);
});

bus.once("app:ready", () => console.log("Ready"));
await bus.emit("app:ready", undefined);
await bus.emit("user:created", { id: "123" });
bus.off(id);
```

`saveAuditEntry` represents your application's async operation.

## Delivery contract

- `emit(topic, data): Promise<void>` replaces both `send` and `call`. It
  broadcasts to all listeners and uses `Promise.all` to wait for their completion,
  including error reporting. There is no random recipient or listener result.
  `await bus.emit(...)` waits for completion; `void bus.emit(...)` opts out of waiting.
- Callbacks start synchronously in registration order. Returned promises run
  independently, so completion order is unspecified. Return values are ignored.
- No listeners means a no-op. Events are neither stored nor replayed.
- Both `on` and `once` return an ID for `off`. Removing an unknown ID is a no-op.
- Delivery uses a snapshot. Listeners added during delivery join subsequent
  emits (including nested emits). Removed listeners are skipped before invocation.
- A once listener is removed before invocation, even if it throws or emits again.
- Synchronous throws and returned promise rejections go to the constructor's
  error handler. The default logs them. Errors from that handler are also caught
  and logged. Async work that a listener neither returns nor awaits remains the
  listener's responsibility.

## Risks and limits

The supplied implementation allowed unhandled promise rejections and synchronous
throws to interrupt delivery. Iterating a live Map could invoke newly added
listeners in the same broadcast indefinitely. A snapshot alone also needs a
membership check to avoid invoking an already consumed once listener after a
nested emit. This implementation addresses these cases and indexes IDs so `off`
does not scan every topic.

The supplied method-level payload generics allowed unrelated sender and receiver
types. Here `Bus<Events>` takes a topic-to-payload map instead of a topic union;
`on`, `once`, and `emit` infer payloads from that map. These are compile-time
checks only. Validate untrusted data at application boundaries.

Remaining constraints:

- No persistence, retry, acknowledgment, shutdown drain, or delivery across
  processes. Process termination may discard pending work. Use durable storage
  or a job queue for operations that must complete.
- No concurrency limit or backpressure. Frequent emits and slow listeners can
  accumulate promises and retained payloads. Awaiting one emit does not serialize separate emits or limit
  concurrent producers; apply limits in the producer or use a bounded queue.
- A listener or error handler that never settles keeps emit pending.
- Synchronous work blocks the emitter and event loop. Recursive emits can
  overflow the stack; cyclic async emissions can create an endless workload.
- All listeners receive the same payload reference. Mutations are visible to
  other listeners; prefer immutable data or explicitly copy it where needed.
- Listeners retain captured objects until removed. An unused once listener is
  also retained; keep IDs and unsubscribe when their owner is destroyed.
- Listener errors are reported centrally, so they do not reject emit. Configure error reporting
  appropriate to the application; avoid logging sensitive error details.
- IDs require a runtime with global `crypto.randomUUID()` (and a secure context
  in browsers).

## Load tests

Run `npm test -- bus` for unit and load tests, or
`npm test -- bus/bus.load.test.ts --reporter=verbose` for individual load timings.

The load suite checks:

- 1,000 concurrent chats with two listeners each, sending 100,000 messages
  (200,000 deliveries) with actual event-loop yields.
- 5,000 simultaneous emits with 50,000 blocked deliveries and 1,000 once listeners.
- 20,000 synchronous/asynchronous failures with asynchronous error reporting,
  alongside 10,000 successful deliveries.
- 100,000 listener registrations/removals across connection churn, checking that
  removed listeners receive no new events and internal registry entries are released.

Assertions check exact delivery counts, topic isolation, completion semantics,
error attribution, and registry cleanup. A 30-second per-test timeout catches
stalls; there are no machine-dependent throughput thresholds. These are in-process
stress tests, not WebSocket/network benchmarks or proof of bounded heap usage.

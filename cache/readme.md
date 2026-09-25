# Cache

```ts
import { cache } from "@papack/one/cache";

const [get, clear] = cache(async () => {
  const response = await fetch("https://example.com/users");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}, 5_000);

const first = await get();
const reused = await get(); // Same result within five seconds
clear();
const refreshed = await get(); // Calls the function again
```

Also exported from `@papack/one`. The separate entry point works in browsers
and Node without additional dependencies.

`cache(asyncFn, timeInMs?)` returns `[get, clear]`. It stores one result per
cache instance. The function accepts no arguments; capture inputs in its closure
and use separate instances for different inputs/users.

- Loading starts on the first `get()`, not when creating the cache.
- TTL begins when the function successfully resolves. After expiry, the next
  `get()` calls it again; there is no background timer or automatic polling.
- Omit `timeInMs` (or pass `Infinity`) to cache until `clear()`.
- `0` disables reuse of completed results. Concurrent pending requests still
  share one promise. Negative values and `NaN` are rejected.
- Concurrent `get()` calls share a single load, including after expiry.
- Failures reject all waiting callers and are not cached; the next call retries.
- `clear()` invalidates immediately. It does not cancel existing calls, which
  still receive their original result/error. Old calls cannot overwrite or clear
  a newer cache entry.
- Objects are shared by reference; modifying a result modifies the cached value.
  The result is retained until the next refresh, `clear()`, or the cache instance
  becomes unreachable. Expiry alone does not free it via a timer.

Run `npm test -- cache`.

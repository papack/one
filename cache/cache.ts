export type Cached<T> = [
  /** Load on first access, then reuse the result until it expires or is cleared. */
  get: () => Promise<T>,
  /** Invalidate the result, including any currently pending load. */
  clear: () => void,
];

/** Cache one async result. TTL starts after a successful load; refresh is lazy. */
export function cache<T>(
  fn: () => Promise<T>,
  timeInMs: number = Infinity,
): Cached<T> {
  if (Number.isNaN(timeInMs) || timeInMs < 0) {
    throw new RangeError("timeInMs must be a non-negative number or Infinity");
  }

  type Entry = { promise: Promise<T>; expiresAt: number };
  let entry: Entry | undefined;

  return [
    function get(): Promise<T> {
      if (entry && performance.now() < entry.expiresAt) return entry.promise;

      const next: Entry = {
        expiresAt: Infinity,
        promise: Promise.resolve()
          .then(fn)
          .then(
            (value) => {
              next.expiresAt = performance.now() + timeInMs;
              return value;
            },
            (error: unknown) => {
              if (entry === next) entry = undefined;
              throw error;
            },
          ),
      };
      entry = next;
      return next.promise;
    },
    function clear(): void {
      // Old callers may still finish, but their entry cannot replace a new one.
      entry = undefined;
    },
  ];
}

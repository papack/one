/** Yields to timers and I/O in Node and browsers. */
export function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    const setImmediateFn = (
      globalThis as typeof globalThis & {
        setImmediate?: (callback: () => void) => unknown;
      }
    ).setImmediate;
    if (typeof setImmediateFn === "function") setImmediateFn(resolve);
    else setTimeout(resolve, 0);
  });
}

// use-session-storage.ts
import { signal } from "../signal";
import type { ReadFn } from "../signal";

export type SessionStorageHook<T> = [
  value: ReadFn<T>,
  setValue: (updater: (prev: T) => T) => void,
  remove: () => void,
];

export function useSessionStorage<T>(
  key: string,
  initial: T,
): SessionStorageHook<T> {
  let start = initial;

  try {
    const raw = sessionStorage.getItem(key);
    if (raw !== null) {
      start = JSON.parse(raw);
    }
  } catch (err) {
    console.error(`[useSessionStorage] Failed to read key "${key}"`, err);
  }

  const [value, write] = signal<T>(start);

  function setValue(updater: (prev: T) => T) {
    write((prev) => {
      let next: T;

      try {
        next = updater(prev);
      } catch (err) {
        console.error(
          `[useSessionStorage] Updater failed for key "${key}"`,
          err,
        );
        return prev;
      }

      try {
        sessionStorage.setItem(key, JSON.stringify(next));
      } catch (err) {
        console.error(`[useSessionStorage] Failed to write key "${key}"`, err);
      }

      return next;
    });
  }

  function remove() {
    try {
      sessionStorage.removeItem(key);
    } catch (err) {
      console.error(`[useSessionStorage] Failed to remove key "${key}"`, err);
    }

    write(() => initial);
  }

  return [value, setValue, remove];
}

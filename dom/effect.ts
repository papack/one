import { hasActiveMountSession, unmount } from "./lifecycle";
import { connector, type ReadFn } from "./signal";

export function effect<T>(
  read: ReadFn<T>,
  callback: (value: T) => void | Promise<void>,
): void {
  let initialized = false;
  const listener = (value: T) => {
    if (!initialized) {
      initialized = true;
      return;
    }

    try {
      const result = callback(value);
      if (result instanceof Promise) {
        result.catch((error) => console.error("DOM effect failed", error));
      }
    } catch (error) {
      console.error("DOM effect failed", error);
    }
  };

  read(listener);
  if (hasActiveMountSession())
    unmount(() => connector.removeCallback(listener));
}

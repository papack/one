// use-custom-event.ts
import { unmount } from "../lifecycle";

type Handler<T> = (data: T) => void;

/**
 * Creates a custom browser event emitter.
 * If a handler is provided, it is automatically
 * cleaned up on component unmount.
 */
export function useCustomEvent<T = any>(topic: string, handler?: Handler<T>) {
  // register listener if handler exists
  if (handler) {
    const listener = (e: Event) => {
      const ce = e as CustomEvent<T>;
      handler(ce.detail);
    };

    window.addEventListener(topic, listener);

    // automatic cleanup on unmount
    unmount(() => {
      window.removeEventListener(topic, listener);
    });
  }

  // emitter (always returned)
  return function emit(data: T) {
    window.dispatchEvent(new CustomEvent(topic, { detail: data }));
  };
}

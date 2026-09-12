import { unmount } from "../lifecycle";

export function useIntersectionObserver(
  clbk: IntersectionObserverCallback,
  options?: IntersectionObserverInit,
) {
  const obs = new IntersectionObserver(clbk, options);

  unmount(() => {
    obs.disconnect();
  });

  return obs;
}

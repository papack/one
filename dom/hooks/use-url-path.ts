// use-url-path.ts
import { signal, type ReadFn } from "../signal";

type WriteFn<T> = (value: T | ((prev: T) => T)) => void;

function getPath(): string {
  return window.location.pathname || "/";
}

const [path, write] = signal<string>(getPath());

window.addEventListener("popstate", () => {
  const next = getPath();

  if (next !== path()) {
    write(() => next);
  }
});

function setPath(value: string | ((prev: string) => string)) {
  const current = window.location;

  const next = typeof value === "function" ? value(path()) : value;

  const pathname = next.startsWith("/") ? next : `/${next}`;

  if (pathname !== current.pathname) {
    const url = pathname + current.search + current.hash;

    window.history.pushState(null, "", url);

    if (pathname !== path()) {
      write(() => pathname);
    }
  }
}

export function useUrlPath(): [ReadFn<string>, WriteFn<string>] {
  return [path, setPath];
}

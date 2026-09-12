// use-url-hash.ts
import { signal, type ReadFn } from "../signal";

type WriteFn<T> = (value: T | ((prev: T) => T)) => void;

function getHash(): string {
  return window.location.hash.slice(1); //without leading "#"
}

const [hash, write] = signal<string>(getHash());

function sync() {
  const next = getHash();
  if (next !== hash()) {
    write(() => next);
  }
}

window.addEventListener("hashchange", sync);
window.addEventListener("popstate", sync);

function setHash(value: string | ((prev: string) => string)) {
  const next = typeof value === "function" ? value(hash()) : value;

  const normalized =
    next === "" ? "" : next.startsWith("#") ? next : `#${next}`;

  if (normalized !== window.location.hash) {
    const url = window.location.pathname + window.location.search + normalized;

    window.history.pushState(null, "", url);

    sync();
  }
}

export function useUrlHash(): [ReadFn<string>, WriteFn<string>] {
  return [hash, setHash];
}

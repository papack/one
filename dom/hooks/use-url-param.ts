// use-url-param.ts
import { signal, type ReadFn } from "../signal";
import { effect } from "../effect";

type WriteFn<T> = (value: T | ((prev: T) => T)) => void;

function getParams() {
  return new URLSearchParams(window.location.search);
}

const [params, write] = signal(getParams());

window.addEventListener("popstate", () => {
  const next = getParams();

  if (next.toString() !== params().toString()) {
    write(() => next);
  }
});

function getValue(key: string): string {
  return params().get(key) ?? "";
}

function setParam(key: string, value: string | ((prev: string) => string)) {
  const current = getParams();

  const prev = current.get(key) ?? "";

  const next = typeof value === "function" ? value(prev) : value;

  if (next === prev) {
    return;
  }

  if (next === "") {
    current.delete(key);
  } else {
    current.set(key, next);
  }

  const url =
    window.location.pathname +
    (current.toString() ? `?${current}` : "") +
    window.location.hash;

  window.history.pushState(null, "", url);

  if (current.toString() !== params().toString()) {
    write(() => new URLSearchParams(current));
  }
}

export function useUrlParam(key: string): [ReadFn<string>, WriteFn<string>] {
  const [value, setValue] = signal<string>(getValue(key));

  effect(params, () => {
    const next = getValue(key);

    if (next !== value()) {
      setValue(() => next);
    }
  });

  const writeValue: WriteFn<string> = (next) => {
    setParam(key, next);
  };

  return [value, writeValue];
}

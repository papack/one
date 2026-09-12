// use-translation.ts
import { signal, type ReadFn } from "../signal";
import { effect } from "../effect";

export type Translations = {
  [key: string]: {
    [locale: string]: string;
  };
};

export type Data = {
  [key: string]: string | number | ReadFn<string | number>;
};

/**
 * Creates a translation function `t`
 * that returns a reactive signal per key.
 */
export function useText(locale: ReadFn<string>, text: Translations) {
  return function t(key: string, data?: Data): ReadFn<string> {
    const compute = () => resolve(key, locale(), text, data);

    const [read, write] = signal(compute());

    // react to locale changes
    effect(locale, () => {
      write(() => compute());
    });

    // react to data signal changes
    if (data) {
      for (const value of Object.values(data)) {
        if (typeof value === "function" && value.type === "signal") {
          effect(value, () => {
            write(() => compute());
          });
        }
      }
    }

    return read;
  };
}

function resolve(
  key: string,
  locale: string,
  text: Translations,
  data?: Data,
): string {
  const entry = text[key];
  if (!entry) return replacePlaceholders(key, data);

  // exact match
  if (entry[locale]) {
    return replacePlaceholders(entry[locale], data);
  }

  // final fallback
  return replacePlaceholders(key, data);
}

function replacePlaceholders(input: string, data?: Data): string {
  if (!data) return input;

  let out = input;
  for (const [key, value] of Object.entries(data)) {
    const v = typeof value === "function" ? value() : value;
    out = out.split(`{${key}}`).join(String(v));
  }

  return out;
}

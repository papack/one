// use-locale.ts
import { signal } from "../signal";
import type { ReadFn } from "../signal";

export interface LocaleController {
  locale: ReadFn<string>;
  setLocale: (next: string) => void;
}
const [locale, write] = signal("en-US");

export function useLocale(): LocaleController {
  return {
    locale,
    setLocale(next: string) {
      write(() => next);
    },
  };
}

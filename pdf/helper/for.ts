import type { JSXElement } from "../../jsx/jsx";

type ForChild<T> = (item: T, index: number) => JSXElement;

export type ForProps<T> = {
  each: readonly T[];
  children: ForChild<T> | readonly ForChild<T>[];
};

/** Expands an array into JSX children while the PDF document is resolved. */
export function For<T>({ each, children }: ForProps<T>): JSXElement {
  const render = Array.isArray(children) ? children[0] : children;
  if (typeof render !== "function") {
    throw new Error("<For> expects a single function child");
  }
  return each.map((item, index) => render(item, index)) as unknown as JSXElement;
}

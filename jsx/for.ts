import type { JSXRenderable } from "./jsx";

type ForChild<T> = (item: T) => JSXRenderable;

export type ForProps<T> = {
  each: readonly T[];
  children: ForChild<T> | readonly ForChild<T>[];
};

export function For<T>(props: ForProps<T>): JSXRenderable {
  const { each, children } = props;
  if (!each || each.length === 0) return null;

  // JSX factories pass children as an array; accepting a single child keeps the
  // component ergonomic when it is called directly, too.
  const render = Array.isArray(children) ? children[0] : children;
  if (typeof render !== "function") {
    throw new Error("<For> expects a single function child");
  }

  return each.map((item) => render(item)) as JSXRenderable;
}

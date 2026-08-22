export type ForProps<T> = {
  each: readonly T[];
  children: [(item: T) => any];
};

export function For<T>(props: ForProps<T>) {
  const { each, children } = props;
  if (!each || each.length === 0) return null;

  const render = children[0];
  if (typeof render !== "function") {
    throw new Error("<For> expects a single function child");
  }

  return each.map((item) => render(item));
}

import type { JSXElement } from "../../jsx/jsx";

export type RepeatProps = {
  n: number;
  children?: JSXElement;
};

/** Repeats its children a fixed number of times in a PDF document. */
export function Repeat({ n, children }: RepeatProps): JSXElement {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError("<Repeat> expects a non-negative integer for n");
  }
  if (n === 0 || children == null) return null;
  return Array.from({ length: n }, () => children) as unknown as JSXElement;
}

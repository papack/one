import type { JSXElement } from "../jsx/jsx";

type RepeatProps = {
  n: number;
  children: JSXElement;
};

export function Repeat(props: RepeatProps): JSXElement {
  if (props.n <= 0) {
    return null;
  }

  return Array.from({ length: props.n }, () => props.children) as JSXElement;
}

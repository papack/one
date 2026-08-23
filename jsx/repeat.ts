import type { JSXRenderable } from "./jsx";

type RepeatProps = {
  n: number;
  children: JSXRenderable;
};

export function Repeat(props: RepeatProps): JSXRenderable {
  if (props.n <= 0) {
    return null;
  }

  return Array.from({ length: props.n }, () => props.children) as JSXRenderable;
}

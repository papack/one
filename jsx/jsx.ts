import { fragment } from "./fragment";

declare global {
  namespace JSX {
    type Element = JSXNode | Promise<JSXNode>;

    interface IntrinsicElements {
      [tagName: string]: Record<string, unknown>;
    }
  }
}

export type JSXNode = {
  type: string | Component | typeof fragment;
  props: Record<string, unknown>;
  children: unknown[];
};

export type Component = (
  props: Record<string, unknown>,
) => JSXNode | Promise<JSXNode>;

export function jsx(
  type: string | Component | typeof fragment,
  props: Record<string, unknown> | null,
  ...children: unknown[]
): JSXNode {
  return {
    type,
    props: props ?? {},
    children: children.flat(Infinity),
  };
}

import { fragment } from "./fragment";

declare global {
  namespace JSX {
    type Element = JSXNode;

    interface IntrinsicElements {
      [tagName: string]: Record<string, unknown>;
    }
  }
}

export {};

export type JSXNode = {
  type: string | Component | typeof fragment;
  props: Record<string, unknown>;
  children: unknown[];
};

export type Component = (
  props: Record<string, unknown>,
) => JSXNode | Promise<JSXNode>;

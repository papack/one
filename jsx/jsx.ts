import { fragment } from "./fragment";

declare global {
  namespace JSX {
    type Element = JSXElement;

    interface IntrinsicElements {
      [tagName: string]: Record<string, unknown>;
    }

    interface ElementChildrenAttribute {
      children: {};
    }
  }
}

export type JSXNode = {
  type: string | Component | typeof fragment;
  props: Record<string, unknown>;
  children: unknown[];
};

type JSXValue = JSXNode | string | number | boolean | null | undefined;

type JSXSyncRenderable = JSXValue | readonly JSXSyncRenderable[];

export type JSXElement = JSXSyncRenderable | Promise<JSXSyncRenderable>;

export type Component = (props: any) => JSXElement;

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

import type { JSXElement } from "../../jsx/jsx";

export type ShowProps = {
  when: boolean;
  children?: JSXElement;
};

/** Includes its children only when the condition is true. */
export function Show({ when, children }: ShowProps): JSXElement {
  return when ? children : null;
}

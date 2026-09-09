import type { JSXElement } from "../jsx/jsx";

type ShowProps = {
  when: boolean;
  children: JSXElement;
};

export function Show(props: ShowProps): JSXElement {
  return props.when ? props.children : null;
}

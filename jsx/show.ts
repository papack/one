import type { JSXRenderable } from "./jsx";

type ShowProps = {
  when: boolean;
  children: JSXRenderable;
};

export function Show(props: ShowProps): JSXRenderable {
  return props.when ? props.children : null;
}

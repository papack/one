import { jsx } from "../jsx";
import { destroy } from "./destroy";
import { mount, unmount } from "./lifecycle";
import { connector, type ReadFn } from "./signal";
import { dom, type DomContext } from "./dom";

export interface ShowProps {
  when: ReadFn<boolean>;
  children?: unknown[];
}

/** Mounts and destroys its children as the signal changes. */
export function Show({ when, children = [] }: ShowProps): null {
  const host = jsx("dom-show", { style: { display: "contents" } });
  const content = jsx(
    "dom-show-content",
    { style: { display: "contents" } },
    ...children,
  );

  mount((parent) => {
    const hostElement = dom(host, { parent }).node;
    if (!(hostElement instanceof Element)) {
      throw new Error("Show needs an Element host");
    }

    let visible = false;
    let contentElement: Element | null = null;
    const context: DomContext = { parent: hostElement };
    const listener = (next: boolean) => {
      if (next === visible) return;
      visible = next;

      if (!visible) {
        if (contentElement) destroy(contentElement);
        contentElement = null;
        return;
      }

      const result = dom(content, context).node;
      if (!(result instanceof Element)) {
        throw new Error("Show children need an Element root");
      }
      contentElement = result;
    };

    when(listener);
    unmount(() => connector.removeCallback(listener));
  });

  return null;
}

import { jsx } from "../jsx";
import type { JSXElement } from "../jsx/jsx";
import { destroy } from "./destroy";
import { dom, type DomContext } from "./dom";
import { effect } from "./effect";
import { mount } from "./lifecycle";
import type { ReadFn } from "./signal";

interface Keyed {
  uuid: string;
}

export interface ForProps<T extends Keyed> {
  each: ReadFn<T[]>;
  children?: ((item: T) => unknown)[];
}

/** Keyed structural list renderer. Existing entries are moved, not rerendered. */
export function For<T extends Keyed>({
  each,
  children = [],
}: ForProps<T>): null {
  const child = children[0];
  if (typeof child !== "function") {
    throw new Error("<For> expects a single function child");
  }

  const host = jsx("dom-for", { style: { display: "contents" } });

  mount((parent) => {
    const hostNode = dom(host, { parent }).node;
    if (!(hostNode instanceof Element))
      throw new Error("For needs an Element host");

    const nodes = new Map<string, Element>();
    let order: string[] = [];
    const context: DomContext = { parent: hostNode };

    const reconcile = (items: T[]) => {
      const nextOrder: string[] = [];

      for (const item of items) {
        if (!item || item.uuid == null) continue;
        nextOrder.push(item.uuid);

        if (!nodes.has(item.uuid)) {
          const result = dom(child(item) as JSXElement, context).node;
          if (!(result instanceof Element)) {
            throw new Error("For children need an Element root");
          }
          nodes.set(item.uuid, result);
        }
      }

      for (const uuid of order) {
        if (nextOrder.includes(uuid)) continue;
        const node = nodes.get(uuid);
        if (node) destroy(node);
        nodes.delete(uuid);
      }

      let anchor: ChildNode | null = null;
      for (const uuid of [...nextOrder].reverse()) {
        hostNode.insertBefore(nodes.get(uuid)!, anchor);
        anchor = nodes.get(uuid)!;
      }

      order = nextOrder;
    };

    reconcile(each());
    effect(each, reconcile);
  });

  return null;
}

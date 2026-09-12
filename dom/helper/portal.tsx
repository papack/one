import { mount, unmount } from "../lifecycle";
import { dom } from "../dom";
import { destroy } from "../destroy";
import type { JSXElement } from "../../jsx/jsx";

interface PortalProps {
  children?: JSXElement | JSXElement[];
}

export function Portal({ children }: PortalProps): null {
  const host = document.createElement("csr-portal");
  const childNodes =
    children == null ? [] : Array.isArray(children) ? children : [children];

  mount(() => {
    document.body.appendChild(host);

    for (const child of childNodes) {
      dom(child, {
        parent: host,
      });
    }
  });

  unmount(() => {
    destroy(host);
  });

  return null;
}

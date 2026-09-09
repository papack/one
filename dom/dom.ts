import { fragment } from "../jsx/fragment";
import type { JSXElement, JSXNode } from "../jsx/jsx";
import { connector, type ReadFn } from "./signal";
import {
  beginMountSession,
  endMountSession,
  hasActiveMountSession,
  unmount,
} from "./lifecycle";

export interface DomContext {
  parent: Element | DocumentFragment;
  [key: string]: unknown;
}

export interface DomResult {
  node: Node;
}

/** Mounts a synchronous JSXElement tree into a real DOM parent. */
export function dom(node: JSXElement, context: DomContext): DomResult {
  return mountNode(node, context);
}

function mountNode(node: JSXElement | unknown, context: DomContext): DomResult {
  if (node instanceof Promise) {
    throw new Error("dom() cannot render async JSX components");
  }

  if (node == null || typeof node === "boolean")
    return { node: context.parent };

  if (typeof node === "string" || typeof node === "number") {
    const text = document.createTextNode(String(node));
    context.parent.appendChild(text);
    return { node: text };
  }

  if (isSignal(node)) return mountSignal(node, context);

  if (Array.isArray(node)) {
    let last: Node = context.parent;
    for (const child of node) last = mountNode(child, context).node;
    return { node: last };
  }

  if (!isJsxNode(node))
    throw new Error("dom() received an unsupported JSX value");

  if (node.type === fragment) return mountNode(node.children, context);

  if (typeof node.type === "function") {
    beginMountSession();
    const resolved = node.type({
      ...node.props,
      children: node.children,
      ctx: context,
    });
    const result = mountNode(resolved, context);
    const root = result.node instanceof Element ? result.node : context.parent;

    if (!(root instanceof Element)) {
      throw new Error("DOM components need an Element parent");
    }

    endMountSession(root);
    return result;
  }

  return mountElement(node, context);
}

function mountElement(node: JSXNode, context: DomContext): DomResult {
  if (typeof node.type !== "string") {
    throw new Error("DOM host nodes need a string tag");
  }

  const element = createElement(node.type);

  for (const [key, value] of Object.entries(node.props)) {
    setProperty(element, key, value);
  }

  context.parent.appendChild(element);
  for (const child of node.children)
    mountNode(child, { ...context, parent: element });
  return { node: element };
}

function createElement(tag: string): Element {
  return SVG_TAGS.has(tag)
    ? document.createElementNS("http://www.w3.org/2000/svg", tag)
    : document.createElement(tag);
}

function setProperty(element: Element, key: string, value: unknown): void {
  if (key === "children" || key === "ctx" || value == null || value === false)
    return;

  if (key.startsWith("on") && typeof value === "function") {
    element.addEventListener(
      key.slice(2).toLowerCase(),
      value as EventListener,
    );
    return;
  }

  if (key === "style") {
    setStyle(element, value);
    return;
  }

  if (isSignal(value)) {
    const apply = (next: unknown) => setProperty(element, key, next);
    value(apply);
    if (hasActiveMountSession()) unmount(() => connector.removeCallback(apply));
    return;
  }

  const attribute = key === "className" ? "class" : key;
  if (value === true) {
    element.setAttribute(attribute, "");
  } else if (attribute in element) {
    (element as unknown as Record<string, unknown>)[attribute] = value;
  } else {
    element.setAttribute(attribute, String(value));
  }
}

function setStyle(element: Element, value: unknown): void {
  if (typeof value === "string") {
    element.setAttribute("style", value);
    return;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return;

  for (const [property, styleValue] of Object.entries(value)) {
    if (styleValue == null) continue;
    const apply = (next: unknown) => applyStyle(element, property, next);
    if (isSignal(styleValue)) {
      styleValue(apply);
      if (hasActiveMountSession())
        unmount(() => connector.removeCallback(apply));
    } else {
      apply(styleValue);
    }
  }
}

function applyStyle(element: Element, property: string, value: unknown): void {
  const style = (element as HTMLElement | SVGElement).style;

  if (property.startsWith("--")) {
    style.setProperty(property, String(value));
  } else {
    (style as unknown as Record<string, unknown>)[property] = String(value);
  }
}

function mountSignal(read: ReadFn<unknown>, context: DomContext): DomResult {
  const text = document.createTextNode(String(read()));
  context.parent.appendChild(text);

  const apply = (value: unknown) => {
    text.nodeValue = String(value);
  };

  read(apply);
  if (hasActiveMountSession()) unmount(() => connector.removeCallback(apply));

  return { node: text };
}

function isJsxNode(value: unknown): value is JSXNode {
  return (
    !!value &&
    typeof value === "object" &&
    "type" in value &&
    "children" in value
  );
}

function isSignal(value: unknown): value is ReadFn<unknown> {
  return (
    typeof value === "function" && (value as ReadFn<unknown>).type === "signal"
  );
}

const SVG_TAGS = new Set([
  "svg",
  "path",
  "circle",
  "rect",
  "line",
  "polyline",
  "polygon",
  "g",
  "defs",
  "linearGradient",
  "radialGradient",
  "stop",
  "mask",
  "clipPath",
  "pattern",
  "text",
  "tspan",
  "use",
  "symbol",
  "view",
  "ellipse",
  "foreignObject",
]);

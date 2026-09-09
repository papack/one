import { JSXNode } from "../jsx/jsx";
import { fragment } from "../jsx/fragment";

export async function html(node: unknown): Promise<string> {
  return "<!doctype html>" + (await render(node));
}

async function render(node: unknown): Promise<string> {
  // A child may itself be a Promise
  node = await node;

  // null / undefined / boolean
  if (node == null || typeof node === "boolean") {
    return "";
  }

  // Text
  if (typeof node === "string" || typeof node === "number") {
    return escapeHtml(String(node));
  }

  // Arrays, e.g. from .map()
  if (Array.isArray(node)) {
    return (await Promise.all(node.map(render))).join("");
  }

  const { type, props = {}, children = [] } = node as JSXNode;

  // Fragment
  if (type === fragment) {
    return (await Promise.all(children.map(render))).join("");
  }

  // Function component
  if (typeof type === "function") {
    return render(
      type({
        ...props,
        children,
      }),
    );
  }

  // Regular HTML element
  const attrs = renderAttributes(props);
  const content = (await Promise.all(children.map(render))).join("");

  return `<${type}${attrs}>${content}</${type}>`;
}

function renderAttributes(props: Record<string, unknown>): string {
  return Object.entries(props)
    .filter(([key]) => key !== "children")
    .filter(([, value]) => value != null && value !== false)
    .map(([key, value]) => {
      if (key === "style") {
        const style = renderStyle(value);
        return style ? ` style="${escapeHtml(style)}"` : "";
      }

      // disabled={true} -> disabled
      if (value === true) {
        return ` ${key}`;
      }

      return ` ${key}="${escapeHtml(String(value))}"`;
    })
    .join("");
}

function renderStyle(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";

  return Object.entries(value as Record<string, unknown>)
    .filter(([, styleValue]) => styleValue != null)
    .map(
      ([property, styleValue]) =>
        `${kebabCase(property)}:${String(styleValue)}`,
    )
    .join(";");
}

function kebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

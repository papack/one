import type { JSXElement, JSXNode } from "../jsx/jsx";

export type PdfDocumentContext = {
  root?: JSXNode;
  metadata: Record<string, unknown>;
  authoredPages: JSXNode[];
};

export function getPdfDocumentContext(element: JSXElement): PdfDocumentContext {
  const root = Array.isArray(element)
    ? element.find(isJSXNode)
    : isJSXNode(element)
      ? element
      : undefined;
  const children = root
    ? Array.isArray(root.children)
      ? root.children
      : [root.children]
    : [];
  return {
    root,
    metadata: root?.type === "document" ? asRecord(root.props) : {},
    authoredPages: children.filter(
      (child): child is JSXNode => isJSXNode(child) && child.type === "page",
    ),
  };
}

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

export function isJSXNode(value: unknown): value is JSXNode {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "props" in value &&
    "children" in value
  );
}

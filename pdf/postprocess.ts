import type { JSXNode } from "../jsx/jsx";
import { asRecord, isJSXNode, measureTextWidth } from "./layout";
import type { TtfFont } from "./ttf";

/** Applies actual page-number text after pagination and fixes affected row geometry. */
export function postprocess(
  pages: readonly JSXNode[],
  fonts: ReadonlyMap<string, TtfFont>,
): JSXNode[] {
  const totalPages = pages.length;
  return pages.map((page, index) =>
    processNode(
      {
        ...page,
        props: { ...page.props, pageNumber: index + 1, totalPages },
      },
      index + 1,
      totalPages,
      fonts,
    ),
  );
}

function processNode(
  node: JSXNode,
  pageNumber: number,
  totalPages: number,
  fonts: ReadonlyMap<string, TtfFont>,
): JSXNode {
  const sourceChildren = Array.isArray(node.children)
    ? node.children
    : [node.children];
  const children = sourceChildren.map((child) =>
    isJSXNode(child)
      ? processNode(child, pageNumber, totalPages, fonts)
      : child,
  );
  let result: JSXNode = { ...node, children };
  const dynamicText = node.props.dynamicText;
  const text =
    dynamicText === "pageNumber"
      ? String(pageNumber)
      : dynamicText === "pagesTotal"
        ? String(totalPages)
        : undefined;

  if (text !== undefined && node.layout) {
    const style = asRecord(node.props.style);
    const width = measureTextWidth(text, style, fonts);
    result = {
      ...result,
      props: { ...node.props, value: text },
      layout: {
        ...node.layout,
        width,
        measuredTextWidth: width,
        textLines: [text],
      },
    };
  }

  return reflowRow(result, children);
}

function reflowRow(parent: JSXNode, children: unknown[]): JSXNode {
  const layout = parent.layout;
  if (!layout) return parent;
  const style = asRecord(parent.props.style);
  const direction =
    style.flexDirection === "row" || style.flexDirection === "row-reverse";
  if (!direction) return parent;

  const flowChildren = children.filter(
    (child): child is JSXNode =>
      isJSXNode(child) &&
      asRecord(child.props.style).position !== "absolute" &&
      asRecord(child.props.style).position !== "fixed",
  );
  if (flowChildren.length === 0) return parent;

  const gap = numeric(style.columnGap ?? style.gap);
  const occupied =
    flowChildren.reduce((sum, child) => {
      const margins = horizontalMargins(child);
      return sum + (child.layout?.width ?? 0) + margins.left + margins.right;
    }, 0) +
    gap * (flowChildren.length - 1);
  const intrinsic = layout.widthMode === "intrinsic";
  const contentWidth = intrinsic ? occupied : layout.contentWidth;
  const width = intrinsic
    ? contentWidth + Math.max(0, layout.width - layout.contentWidth)
    : layout.width;
  const available = Math.max(0, contentWidth - occupied);
  const justify = style.justifyContent;
  const extraGap =
    justify === "space-between" && flowChildren.length > 1
      ? available / (flowChildren.length - 1)
      : 0;
  let cursor =
    justify === "flex-end"
      ? available
      : justify === "center"
        ? available / 2
        : 0;

  if (
    !Number.isFinite(layout.contentX) ||
    !Number.isFinite(contentWidth) ||
    !Number.isFinite(occupied)
  )
    return parent;

  const positions = new Map<JSXNode, number>();
  const ordered =
    style.flexDirection === "row-reverse"
      ? [...flowChildren].reverse()
      : flowChildren;
  for (const child of ordered) {
    const margins = horizontalMargins(child);
    cursor += margins.left;
    positions.set(child, layout.contentX + cursor);
    cursor += (child.layout?.width ?? 0) + margins.right + gap + extraGap;
  }

  const updatedChildren = children.map((child) => {
    if (!isJSXNode(child) || !positions.has(child) || !child.layout)
      return child;
    return shiftNode(child, positions.get(child)! - child.layout.xPos);
  });
  return {
    ...parent,
    children: updatedChildren,
    layout: intrinsic ? { ...layout, width, contentWidth } : layout,
  };
}

function shiftNode(node: JSXNode, deltaX: number): JSXNode {
  const children = Array.isArray(node.children)
    ? node.children.map((child) =>
        isJSXNode(child) ? shiftNode(child, deltaX) : child,
      )
    : node.children;
  return {
    ...node,
    children,
    ...(node.layout
      ? {
          layout: {
            ...node.layout,
            xPos: node.layout.xPos + deltaX,
            contentX: node.layout.contentX + deltaX,
          },
        }
      : {}),
  };
}

function horizontalMargins(node: JSXNode): { left: number; right: number } {
  const style = asRecord(node.props.style);
  return {
    left: numeric(style.marginLeft ?? style.marginHorizontal ?? style.margin),
    right: numeric(style.marginRight ?? style.marginHorizontal ?? style.margin),
  };
}

function numeric(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

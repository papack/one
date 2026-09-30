import type { JSXElement, JSXNode } from "../jsx/jsx";

type PageGroups = Map<number, JSXNode>;
type PageFlow = { contentTop: number; contentHeight: number };

/** Splits a laid-out document into page trees and makes every y coordinate page-local. */
export function paginate(element: JSXElement): JSXNode[] {
  const root = Array.isArray(element) ? element.find(isJSXNode) : element;
  if (!isJSXNode(root)) return [];

  const children = Array.isArray(root.children)
    ? root.children
    : [root.children];

  // Explicit <page> nodes are paginated independently and become the returned
  // page roots. Their source-tree offsets are removed before splitting.
  const explicitPages = children.filter(
    (child): child is JSXNode => isJSXNode(child) && child.type === "page",
  );
  if (explicitPages.length > 0) {
    const result: JSXNode[] = [];
    // Fixed elements authored at document level share the same page viewport
    // as fixed elements declared inside an explicit page.
    const documentFixedNodes = children.filter(
      (child): child is JSXNode =>
        isJSXNode(child) &&
        child.type !== "page" &&
        asRecord(child.props.style).position === "fixed",
    );
    for (const page of explicitPages) {
      const pageHeight = positive(page.layout?.height, 842);
      const pageWidth = positive(page.layout?.width, 595);
      const originX = page.layout?.xPos ?? 0;
      const originY = page.layout?.yPos ?? 0;
      const localPage = shiftNode(page, -originX, -originY);
      const fixedNodes: JSXNode[] = [];
      const flowPage = stripFixedNodes(localPage, fixedNodes, true);
      const pageFrame = {
        ...(localPage.layout ?? emptyLayout(pageWidth, pageHeight)),
        xPos: 0,
        yPos: 0,
        width: pageWidth,
        height: pageHeight,
      };
      const flow = pageFlow(localPage.layout, pageHeight);
      for (const fragment of paginateNode(flowPage, flow).values()) {
        const fragmentChildren = Array.isArray(fragment.children)
          ? fragment.children
          : [fragment.children];
        result.push({
          ...fragment,
          children: [...fragmentChildren, ...fixedNodes, ...documentFixedNodes],
          layout: pageFrame,
        });
      }
    }
    const totalPages = result.length;
    return result.map((page, index) => ({
      ...page,
      props: { ...page.props, pageNumber: index + 1, totalPages },
    }));
  }

  // Keep implicit pagination working for documents without explicit pages.
  const pageHeight = positive(root.layout?.height, 842);
  const pageWidth = positive(root.layout?.width, 595);
  const flow = pageFlow(root.layout, pageHeight);
  const pageChildren = new Map<number, JSXNode[]>();
  const fixedNodes: JSXNode[] = [];

  for (const child of children) {
    const flowChild = stripFixedNodes(child, fixedNodes);
    const groups = paginateNode(flowChild, flow);
    for (const [pageIndex, fragment] of groups) {
      const page = pageChildren.get(pageIndex) ?? [];
      page.push(fragment);
      pageChildren.set(pageIndex, page);
    }
  }

  const lastPage = Math.max(0, ...pageChildren.keys());
  const totalPages = lastPage + 1;

  return Array.from({ length: totalPages }, (_, pageIndex) => {
    const pageLayout = {
      xPos: 0,
      yPos: 0,
      width: pageWidth,
      height: pageHeight,
      contentX: root.layout?.contentX ?? 0,
      contentY: flow.contentTop,
      contentWidth: root.layout?.contentWidth ?? pageWidth,
      contentHeight: flow.contentHeight,
    };

    return {
      ...root,
      props: { ...root.props, pageNumber: pageIndex + 1, totalPages },
      children: [...(pageChildren.get(pageIndex) ?? []), ...fixedNodes],
      layout: pageLayout,
    };
  });
}

function stripFixedNodes(
  node: unknown,
  fixedNodes: JSXNode[],
  keepRoot = false,
): JSXNode {
  if (!isJSXNode(node)) return node as JSXNode;
  if (!keepRoot && asRecord(node.props.style).position === "fixed") {
    fixedNodes.push(node);
    return { ...node, children: [] };
  }
  const children = Array.isArray(node.children)
    ? node.children
    : [node.children];
  const remaining: unknown[] = [];
  for (const child of children) {
    if (isJSXNode(child) && asRecord(child.props.style).position === "fixed")
      fixedNodes.push(child);
    else if (isJSXNode(child))
      remaining.push(stripFixedNodes(child, fixedNodes));
    else remaining.push(child);
  }
  return { ...node, children: remaining };
}

function shiftNode(node: JSXNode, xOffset: number, yOffset: number): JSXNode {
  const children = Array.isArray(node.children)
    ? node.children.map((child) =>
        isJSXNode(child) ? shiftNode(child, xOffset, yOffset) : child,
      )
    : node.children;
  const layout = node.layout
    ? {
        ...node.layout,
        xPos: node.layout.xPos + xOffset,
        yPos: node.layout.yPos + yOffset,
        contentX: node.layout.contentX + xOffset,
        contentY: node.layout.contentY + yOffset,
      }
    : undefined;
  return { ...node, children, ...(layout ? { layout } : {}) };
}

function emptyLayout(
  width: number,
  height: number,
): NonNullable<JSXNode["layout"]> {
  return {
    xPos: 0,
    yPos: 0,
    width,
    height,
    contentX: 0,
    contentY: 0,
    contentWidth: width,
    contentHeight: height,
  };
}

function paginateNode(node: unknown, flow: PageFlow): PageGroups {
  if (!isJSXNode(node)) return new Map();
  if (asRecord(node.props.style).position === "fixed") return new Map();
  let currentNode = node;
  let box = currentNode.layout;

  if (node.type === "table") {
    const sourceRows = Array.isArray(node.children)
      ? node.children
      : [node.children];
    const tableHeader = sourceRows.find(
      (row) =>
        isJSXNode(row) &&
        row.type === "table-row" &&
        asRecord(row.props).tableHeader === true,
    );
    const repeatedHeaderHeight = isJSXNode(tableHeader)
      ? (tableHeader.layout?.height ?? 0)
      : 0;
    let accumulatedShift = 0;
    const rows = sourceRows.map((sourceRow) => {
      if (
        !isJSXNode(sourceRow) ||
        sourceRow.type !== "table-row" ||
        asRecord(sourceRow.props).tableHeader === true
      )
        return sourceRow;
      let row = accumulatedShift
        ? shiftNodeY(sourceRow, accumulatedShift)
        : sourceRow;
      const rowBox = row.layout;
      if (rowBox && rowBox.height <= flow.contentHeight) {
        const firstPage = pageIndexAt(rowBox.yPos, flow);
        const lastPage = pageIndexAt(
          rowBox.yPos + Math.max(0, rowBox.height - 0.000001),
          flow,
        );
        if (lastPage > firstPage) {
          const nextPageTop =
            flow.contentTop + (firstPage + 1) * flow.contentHeight;
          const delta = nextPageTop - rowBox.yPos + repeatedHeaderHeight;
          accumulatedShift += delta;
          row = shiftNodeY(row, delta);
        }
      }
      return row;
    });
    currentNode = {
      ...node,
      children: rows,
      ...(box && accumulatedShift
        ? { layout: { ...box, height: box.height + accumulatedShift } }
        : {}),
    };
    box = currentNode.layout;
  }

  if (currentNode.type === "#text" && box?.textLines?.length) {
    return paginateText(currentNode, flow);
  }

  const childGroups = new Map<number, JSXNode[]>();
  const children = Array.isArray(currentNode.children)
    ? currentNode.children
    : [currentNode.children];
  for (const child of children) {
    for (const [pageIndex, fragment] of paginateNode(child, flow)) {
      const page = childGroups.get(pageIndex) ?? [];
      page.push(fragment);
      childGroups.set(pageIndex, page);
    }
  }

  const pageIndices = new Set(childGroups.keys());
  if (box && currentNode.type !== "page") {
    for (const pageIndex of pageRange(box.yPos, box.height, flow)) {
      pageIndices.add(pageIndex);
    }
  }
  if (pageIndices.size === 0) pageIndices.add(0);

  let repeatedHeader: JSXNode | undefined;
  let firstHeaderPage = 0;
  if (currentNode.type === "table") {
    const header = children.find(
      (child) =>
        isJSXNode(child) &&
        child.type === "table-row" &&
        asRecord(child.props).tableHeader === true,
    );
    if (isJSXNode(header)) {
      const headerGroups = paginateNode(header, flow);
      const headerPages = [...headerGroups.keys()].sort((a, b) => a - b);
      if (headerPages.length > 0) {
        firstHeaderPage = headerPages[0];
        repeatedHeader = headerGroups.get(firstHeaderPage);
      }
    }
  }

  const result: PageGroups = new Map();
  for (const pageIndex of pageIndices) {
    const pageChildren = [...(childGroups.get(pageIndex) ?? [])];
    if (repeatedHeader && pageIndex > firstHeaderPage) {
      const targetY = flow.contentTop;
      const repeated = shiftNodeY(
        repeatedHeader,
        targetY - (repeatedHeader.layout?.yPos ?? targetY),
      );
      pageChildren.unshift(repeated);
    }
    result.set(pageIndex, {
      ...currentNode,
      children: pageChildren,
      ...(box ? { layout: pageLocalLayout(box, pageIndex, flow) } : {}),
    });
  }
  return result;
}

function shiftNodeY(node: JSXNode, deltaY: number): JSXNode {
  const children = Array.isArray(node.children)
    ? node.children.map((child) =>
        isJSXNode(child) ? shiftNodeY(child, deltaY) : child,
      )
    : node.children;
  return {
    ...node,
    children,
    ...(node.layout
      ? {
          layout: {
            ...node.layout,
            yPos: node.layout.yPos + deltaY,
            contentY: node.layout.contentY + deltaY,
          },
        }
      : {}),
  };
}

function paginateText(node: JSXNode, flow: PageFlow): PageGroups {
  const box = node.layout!;
  const lines = box.textLines ?? [];
  const lineHeight = positive(
    box.lineHeight,
    box.height / Math.max(1, lines.length),
  );
  const pages = new Map<number, { lines: string[]; firstLineIndex: number }>();

  lines.forEach((line, lineIndex) => {
    const lineY = box.yPos + lineIndex * lineHeight;
    const pageIndex = pageIndexForLine(lineY, lineHeight, flow);
    const page = pages.get(pageIndex) ?? {
      lines: [],
      firstLineIndex: lineIndex,
    };
    page.lines.push(line);
    pages.set(pageIndex, page);
  });

  const result: PageGroups = new Map();
  for (const [pageIndex, page] of pages) {
    const pageOffset = pageIndex * flow.contentHeight;
    const localY = Math.max(
      flow.contentTop,
      box.yPos + page.firstLineIndex * lineHeight - pageOffset,
    );
    const textLines = page.lines;
    result.set(pageIndex, {
      ...node,
      props: { ...node.props, value: textLines.join(" ") },
      children: [],
      layout: {
        ...box,
        yPos: localY,
        contentY: localY,
        height: textLines.length * lineHeight,
        contentHeight: textLines.length * lineHeight,
        textLines,
      },
    });
  }
  return result;
}

function pageLocalLayout(
  box: NonNullable<JSXNode["layout"]>,
  pageIndex: number,
  flow: PageFlow,
): NonNullable<JSXNode["layout"]> {
  const pageOffset = pageIndex * flow.contentHeight;
  const pageTop = flow.contentTop + pageOffset;
  const pageBottom = pageTop + flow.contentHeight;
  const nodeBottom = box.yPos + box.height;
  const fragmentTop = Math.max(box.yPos, pageTop);
  const fragmentBottom = Math.min(nodeBottom, pageBottom);
  const contentTop = Math.max(box.contentY, fragmentTop);
  const contentBottom = Math.min(
    box.contentY + box.contentHeight,
    fragmentBottom,
  );

  return {
    ...box,
    yPos: fragmentTop - pageOffset,
    height: Math.max(0, fragmentBottom - fragmentTop),
    contentY: Math.max(0, contentTop - pageOffset),
    contentHeight: Math.max(0, contentBottom - contentTop),
  };
}

function pageRange(y: number, height: number, flow: PageFlow): number[] {
  const first = pageIndexAt(y, flow);
  const last =
    height <= 0
      ? first
      : Math.max(first, pageIndexAt(y + height - 0.000001, flow));
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

function pageIndexAt(y: number, flow: PageFlow): number {
  return Math.max(0, Math.floor((y - flow.contentTop) / flow.contentHeight));
}

function pageIndexForLine(
  y: number,
  lineHeight: number,
  flow: PageFlow,
): number {
  const pageIndex = pageIndexAt(y, flow);
  const pageBottom = flow.contentTop + (pageIndex + 1) * flow.contentHeight;
  if (lineHeight <= flow.contentHeight && y + lineHeight > pageBottom)
    return pageIndex + 1;
  return pageIndex;
}

function pageFlow(layout: JSXNode["layout"], pageHeight: number): PageFlow {
  const contentTop = Math.max(0, layout?.contentY ?? 0);
  const bottomPadding = Math.max(
    0,
    pageHeight -
      ((layout?.contentY ?? 0) + (layout?.contentHeight ?? pageHeight)),
  );
  const contentHeight = Math.max(1, pageHeight - contentTop - bottomPadding);
  return { contentTop, contentHeight };
}

function positive(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function isJSXNode(value: unknown): value is JSXNode {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "props" in value &&
    "children" in value
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

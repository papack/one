import { fragment } from "../jsx/fragment";
import type { JSXElement, JSXNode } from "../jsx/jsx";
import { normalize } from "./normalize";
import { paginate } from "./pagination";
import { type PdfDocumentContext } from "./context";
import { collectPdfGlyphs } from "./fonts";
import type { TtfFont } from "./ttf";
import { yieldToEventLoop } from "./yield";

export type LayoutBox = NonNullable<JSXNode["layout"]>;
export type Edges = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type LayoutItem = {
  type: string;
  props: Record<string, unknown>;
  children: LayoutItem[];
  value?: string;
  textLines?: string[];
  textWidthMode?: "intrinsic" | "constrained";
  measuredTextWidth?: number;
  dynamicText?: "pageNumber" | "pagesTotal";
  widthMode?: "intrinsic" | "constrained";
  style: Record<string, unknown>;
  margin: Edges;
  padding: Edges;
  width: number;
  height: number;
  x: number;
  y: number;
  layout?: LayoutBox;
};

export function gridColumns(item: LayoutItem): number[] {
  const raw =
    typeof item.style.gridTemplateColumns === "string"
      ? item.style.gridTemplateColumns
      : "1fr";
  const expanded = raw.replace(
    /repeat\(\s*(\d+)\s*,\s*([^)]*)\)/g,
    (_, count: string, track: string) =>
      Array(Number(count)).fill(track.trim()).join(" "),
  );
  const tracks = expanded.trim().split(/\s+/).filter(Boolean);
  if (!tracks.length) tracks.push("1fr");
  const gap = length(item.style.columnGap ?? item.style.gap) ?? 0;
  const available = Math.max(
    0,
    item.width -
      item.padding.left -
      item.padding.right -
      gap * (tracks.length - 1),
  );
  const sizes = tracks.map((track) => {
    if (track.endsWith("fr"))
      return { kind: "fr", value: Math.max(0, Number.parseFloat(track) || 1) };
    if (track === "auto" || track === "min-content" || track === "max-content")
      return { kind: "auto", value: 0 };
    const length = /^(-?(?:\d+\.?\d*|\.\d+))(?:px|pt)?$/.exec(track);
    return {
      kind: "fixed",
      value:
        dimension(track, available) ??
        (length ? Number(length[1]) : number(track, 0)),
    };
  });
  for (const [index, child] of item.children
    .filter((child) => !isOutOfFlow(child))
    .entries()) {
    const column = index % tracks.length;
    if (sizes[column].kind === "auto")
      sizes[column].value = Math.max(sizes[column].value, outerWidth(child));
  }
  const fixed = sizes.reduce(
    (sum, track) => sum + (track.kind === "fr" ? 0 : track.value),
    0,
  );
  const frTotal = sizes.reduce(
    (sum, track) => sum + (track.kind === "fr" ? track.value : 0),
    0,
  );
  const unit = frTotal > 0 ? Math.max(0, available - fixed) / frTotal : 0;
  return sizes.map((track) =>
    track.kind === "fr" ? track.value * unit : track.value,
  );
}

export const PAGE_WIDTH = 595;
export const PAGE_HEIGHT = 842;
export type PositionType = "static" | "relative" | "absolute" | "fixed";

const PAGE_SIZES: Record<string, readonly [number, number]> = {
  A0: [2384, 3370],
  A1: [1684, 2384],
  A2: [1191, 1684],
  A3: [842, 1191],
  A4: [PAGE_WIDTH, PAGE_HEIGHT],
  A5: [420, 595],
  A6: [298, 420],
  LETTER: [612, 792],
  LEGAL: [612, 1008],
  TABLOID: [792, 1224],
};

export function pageDimensions(
  size: unknown,
  orientation: unknown,
): { width: number; height: number } {
  let dimensions: readonly [number, number] = [PAGE_WIDTH, PAGE_HEIGHT];
  if (typeof size === "string")
    dimensions = PAGE_SIZES[size.toUpperCase()] ?? dimensions;
  else if (
    Array.isArray(size) &&
    size.length >= 2 &&
    size.every(
      (part) => typeof part === "number" && Number.isFinite(part) && part > 0,
    )
  ) {
    dimensions = [size[0] as number, size[1] as number];
  }
  const landscape = orientation === "landscape";
  const [width, height] = landscape
    ? dimensions[0] > dimensions[1]
      ? dimensions
      : [dimensions[1], dimensions[0]]
    : dimensions[0] > dimensions[1]
      ? [dimensions[1], dimensions[0]]
      : dimensions;
  return { width, height };
}

export function createLayoutItem(
  value: unknown,
  inheritedTextStyle: Record<string, unknown> = {},
): LayoutItem | null {
  if (value === null || value === undefined || typeof value === "boolean")
    return null;
  if (Array.isArray(value)) {
    const children = value
      .map((child) => createLayoutItem(child, inheritedTextStyle))
      .filter(isLayoutItem);
    return makeItem("#group", {}, children, inheritedTextStyle);
  }
  if (typeof value === "string" || typeof value === "number") {
    return {
      ...makeItem("#text", { value: String(value) }, [], inheritedTextStyle),
      value: String(value),
    };
  }
  if (!isJSXNode(value)) return null;

  const style = asRecord(value.props.style);
  const itemStyle =
    value.type === "page"
      ? {
          ...pageDimensions(value.props.size, value.props.orientation),
          ...style,
        }
      : value.type === "p"
        ? { display: "flex", flexDirection: "row", ...style }
        : style;
  const childTextStyle = inheritTextStyle(inheritedTextStyle, itemStyle);
  const originalChildValues = Array.isArray(value.children)
    ? value.children
    : [value.children];
  const svgChildValues =
    originalChildValues.length > 0
      ? originalChildValues
      : Array.isArray(value.props.svgChildren) &&
          value.props.svgChildren.length > 0
        ? value.props.svgChildren
        : Array.isArray(value.props.children)
          ? value.props.children
          : value.props.children === undefined
            ? []
            : [value.props.children];
  const layoutChildValues =
    value.type === "li" && typeof value.props.listMarker === "string"
      ? [value.props.listMarker, ...originalChildValues]
      : originalChildValues;
  const dynamicText =
    value.type === "page-number" || value.type === "pages-total"
      ? value.type === "page-number"
        ? "pageNumber"
        : "pagesTotal"
      : undefined;
  const isSvg = value.type === "svg";
  const inlineText =
    value.type === "span" ||
    value.type === "strong" ||
    value.type === "b" ||
    value.type === "em" ||
    value.type === "i";
  const inlineStyle = inlineText
    ? {
        ...childTextStyle,
        ...(value.type === "span" ? { marginLeft: 1.5 } : {}),
        ...(value.type === "strong" || value.type === "b"
          ? { fontWeight: "bold" }
          : {}),
        ...(value.type === "em" || value.type === "i"
          ? { fontStyle: "italic" }
          : {}),
      }
    : undefined;
  const inlineValue = inlineText ? collectInlineText(value) : undefined;
  const children =
    dynamicText || inlineText
      ? []
      : isSvg
        ? []
        : layoutChildValues
            .map((child) => createLayoutItem(child, childTextStyle))
            .filter(isLayoutItem);
  if (value.type === fragment) return makeItem("#group", {}, children, {});

  const props = isSvg
    ? { ...value.props, svgChildren: svgChildValues }
    : dynamicText
      ? { ...value.props, dynamicText, value: "0" }
      : value.props;
  const item = makeItem(
    dynamicText || inlineText
      ? "#text"
      : typeof value.type === "string"
        ? value.type
        : "#group",
    props,
    children,
    inlineText ? inlineStyle! : { ...inheritedTextStyle, ...itemStyle },
  );
  item.margin = getEdges(itemStyle, "margin");
  item.padding = getEdges(itemStyle, "padding");
  item.width = value.layout?.width ?? 0;
  item.height = value.layout?.height ?? 0;
  item.layout = value.layout;
  if (item.type === "#text") {
    item.value = inlineText ? inlineValue! : String(props.value ?? "");
    item.dynamicText =
      props.dynamicText === "pageNumber" || props.dynamicText === "pagesTotal"
        ? props.dynamicText
        : undefined;
    item.textLines = value.layout?.textLines;
    item.textWidthMode = value.layout?.textWidthMode;
    item.measuredTextWidth = value.layout?.measuredTextWidth;
  }
  item.widthMode = value.layout?.widthMode;
  return item;
}

function collectInlineText(node: JSXNode): string {
  const children = Array.isArray(node.children)
    ? node.children
    : [node.children];
  return children
    .map((child) => {
      if (typeof child === "string" || typeof child === "number")
        return String(child);
      if (Array.isArray(child))
        return child
          .map((part) =>
            typeof part === "string" || typeof part === "number"
              ? String(part)
              : isJSXNode(part)
                ? collectInlineText(part)
                : "",
          )
          .join("");
      return isJSXNode(child) ? collectInlineText(child) : "";
    })
    .join("");
}

function makeItem(
  type: string,
  props: Record<string, unknown>,
  children: LayoutItem[],
  style: Record<string, unknown>,
): LayoutItem {
  return {
    type,
    props,
    children,
    style,
    margin: zeroEdges(),
    padding: zeroEdges(),
    width: 0,
    height: 0,
    x: 0,
    y: 0,
  };
}

export function toElement(item: LayoutItem): JSXElement | JSXElement[] {
  if (item.type === "svg")
    return {
      type: item.type,
      props: item.props,
      children: [],
      layout: item.layout,
    };
  const children = item.children.map(toElement);
  if (item.type === "#group") return children as unknown as JSXElement[];
  if (item.type === "#text") {
    const textStyle: Record<string, unknown> = {};
    for (const key of [
      "fontSize",
      "fontFamily",
      "fontWeight",
      "fontStyle",
      "lineHeight",
      "letterSpacing",
      "color",
      "textAlign",
      "writingMode",
    ]) {
      if (item.style[key] !== undefined) textStyle[key] = item.style[key];
    }
    return {
      type: "#text",
      props: {
        value: item.value,
        style: textStyle,
        ...(item.dynamicText ? { dynamicText: item.dynamicText } : {}),
      },
      children: [],
      layout: item.layout,
    };
  }
  return { type: item.type, props: item.props, children, layout: item.layout };
}

export function getEdges(
  style: Record<string, unknown>,
  kind: "margin" | "padding",
): Edges {
  const edge = (value: unknown, fallback: unknown) =>
    length(value) ?? length(fallback) ?? 0;
  return {
    top: edge(style[`${kind}Top`], style[`${kind}Vertical`] ?? style[kind]),
    right: edge(
      style[`${kind}Right`],
      style[`${kind}Horizontal`] ?? style[kind],
    ),
    bottom: edge(
      style[`${kind}Bottom`],
      style[`${kind}Vertical`] ?? style[kind],
    ),
    left: edge(style[`${kind}Left`], style[`${kind}Horizontal`] ?? style[kind]),
  };
}

function length(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const match = /^(-?(?:\d+\.?\d*|\.\d+))(pt|px|in|mm|cm|rem)?$/i.exec(
    value.trim(),
  );
  if (!match) return undefined;
  const amount = Number(match[1]);
  switch ((match[2] ?? "pt").toLowerCase()) {
    case "px":
      return amount * 0.75;
    case "rem":
      return amount * 12;
    case "in":
      return amount * 72;
    case "mm":
      return (amount * 72) / 25.4;
    case "cm":
      return (amount * 72) / 2.54;
    default:
      return amount;
  }
}

export function dimension(value: unknown, basis?: number): number | undefined {
  if (typeof value === "number" && Number.isFinite(value))
    return Math.max(0, value);
  if (typeof value !== "string") return undefined;
  const match = /^(-?(?:\d+\.?\d*|\.\d+))(pt|px|in|mm|cm|rem|%|vw|vh)?$/i.exec(
    value.trim(),
  );
  if (!match) return undefined;
  const amount = Number(match[1]);
  switch ((match[2] ?? "pt").toLowerCase()) {
    case "%":
    case "vw":
    case "vh":
      return basis === undefined
        ? undefined
        : Math.max(0, (basis * amount) / 100);
    case "px":
      return Math.max(0, amount * 0.75);
    case "rem":
      return Math.max(0, amount * 12);
    case "in":
      return Math.max(0, amount * 72);
    case "mm":
      return Math.max(0, (amount * 72) / 25.4);
    case "cm":
      return Math.max(0, (amount * 72) / 2.54);
    default:
      return Math.max(0, amount);
  }
}

export function number(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    typeof value === "string" &&
    value.trim() !== "" &&
    Number.isFinite(Number(value))
  )
    return Number(value);
  return fallback;
}

export function outerWidth(item: LayoutItem): number {
  return item.width + item.margin.left + item.margin.right;
}
export function outerHeight(item: LayoutItem): number {
  return item.height + item.margin.top + item.margin.bottom;
}
export function positionType(item: LayoutItem): PositionType {
  const position = item.style.position;
  return position === "relative" ||
    position === "absolute" ||
    position === "fixed"
    ? position
    : "static";
}
export function isOutOfFlow(item: LayoutItem): boolean {
  const position = positionType(item);
  return position === "absolute" || position === "fixed";
}
export function inset(
  item: LayoutItem,
  side: "top" | "right" | "bottom" | "left",
  basis: number,
): number | undefined {
  const value = item.style[side];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const match = /^(-?(?:\d+\.?\d*|\.\d+))%$/.exec(value.trim());
  if (match) return (basis * Number(match[1])) / 100;
  return length(value);
}
export function zeroEdges(): Edges {
  return { top: 0, right: 0, bottom: 0, left: 0 };
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
function isLayoutItem(value: LayoutItem | null): value is LayoutItem {
  return value !== null;
}

function inheritTextStyle(
  parent: Record<string, unknown>,
  own: Record<string, unknown>,
): Record<string, unknown> {
  const inherited = { ...parent };
  for (const key of [
    "fontSize",
    "fontFamily",
    "fontWeight",
    "fontStyle",
    "lineHeight",
    "letterSpacing",
    "color",
    "textAlign",
    "writingMode",
  ]) {
    if (own[key] !== undefined) inherited[key] = own[key];
  }
  return inherited;
}

/** Resolves only widths and flex width allocation; y positions and final heights remain unset. */
export function layoutWidth(
  element: JSXElement,
  fonts: ReadonlyMap<string, TtfFont> = new Map(),
): JSXElement {
  const root = createLayoutItem(element);
  if (!root) return element;
  const width = dimension(root.style.width, PAGE_WIDTH) ?? PAGE_WIDTH;
  computeWidth(root, width, width, width, width, fonts);
  writeWidthBoxes(root);
  return toElement(root) as JSXElement;
}

function computeWidth(
  item: LayoutItem,
  availableWidth?: number,
  forcedWidth?: number,
  containingWidth = PAGE_WIDTH,
  viewportWidth = PAGE_WIDTH,
  fonts: ReadonlyMap<string, TtfFont> = new Map(),
): void {
  if (item.type === "#group") {
    item.children.forEach((child) =>
      computeWidth(
        child,
        availableWidth,
        undefined,
        containingWidth,
        viewportWidth,
        fonts,
      ),
    );
    item.width = item.children.reduce(
      (max, child) => Math.max(max, child.width),
      0,
    );
    item.widthMode = "intrinsic";
    return;
  }

  if (item.type === "#text") {
    const vertical =
      item.style.writingMode === "vertical-rl" ||
      item.style.writingMode === "vertical-lr";
    const requested =
      forcedWidth ??
      dimension(item.style.width, availableWidth) ??
      availableWidth;
    item.textWidthMode = requested === undefined ? "intrinsic" : "constrained";
    item.widthMode = item.textWidthMode;
    item.measuredTextWidth = measureTextWidth(
      item.value ?? "",
      item.style,
      fonts,
    );
    item.width = Math.max(
      0,
      vertical
        ? number(item.style.fontSize, 12) * 1.2
        : (requested ?? item.measuredTextWidth),
    );
    return;
  }

  if (item.type === "img") {
    const image = asRecord(item.props.image);
    const imageWidth = number(image.width, 0);
    const imageHeight = number(image.height, 0);
    const aspectRatio =
      imageWidth > 0 && imageHeight > 0 ? imageWidth / imageHeight : 1;
    const requested =
      forcedWidth ??
      dimension(item.style.width, availableWidth) ??
      Math.min(
        svgLength(item.props.width) ?? availableWidth ?? Infinity,
        availableWidth ?? Infinity,
      );
    const requestedHeight =
      dimension(item.style.height, availableWidth) ??
      dimension(item.props.height, availableWidth);
    item.width = Math.max(
      0,
      requested ??
        (requestedHeight !== undefined
          ? requestedHeight * aspectRatio
          : imageWidth),
    );
    item.widthMode = requested === undefined ? "intrinsic" : "constrained";
    return;
  }

  if (item.type === "svg") {
    const vb = viewBoxSize(item.props.viewBox);
    const intrinsicWidth = svgLength(item.props.width) ?? vb?.width ?? 0;
    const intrinsicHeight = svgLength(item.props.height) ?? vb?.height ?? 0;
    const requested =
      forcedWidth ??
      dimension(item.style.width, availableWidth) ??
      svgLength(item.props.width) ??
      dimension(item.props.width, availableWidth);
    const requestedHeight =
      dimension(item.style.height, availableWidth) ??
      dimension(item.props.height, availableWidth);
    const ratio =
      intrinsicWidth > 0 && intrinsicHeight > 0
        ? intrinsicWidth / intrinsicHeight
        : 1;
    item.width = Math.max(
      0,
      requested ??
        (requestedHeight !== undefined
          ? requestedHeight * ratio
          : intrinsicWidth),
    );
    item.widthMode = requested === undefined ? "intrinsic" : "constrained";
    return;
  }

  if (item.style.display === "grid") {
    const explicitWidth =
      forcedWidth ??
      dimension(item.style.width, availableWidth) ??
      (item.type === "page" ? PAGE_WIDTH : undefined);
    item.width = Math.max(
      0,
      explicitWidth ??
        Math.max(...item.children.map(outerWidth), 0) +
          item.padding.left +
          item.padding.right,
    );
    item.widthMode = explicitWidth === undefined ? "intrinsic" : "constrained";
    const columns = gridColumns(item);
    const flowChildren = item.children.filter((child) => !isOutOfFlow(child));
    flowChildren.forEach((child, index) => {
      const col = index % columns.length;
      const width = Math.max(
        0,
        columns[col] - child.margin.left - child.margin.right,
      );
      computeWidth(child, width, width, containingWidth, viewportWidth, fonts);
    });
    for (const child of item.children.filter(isOutOfFlow))
      computeWidth(
        child,
        item.width,
        undefined,
        item.width,
        viewportWidth,
        fonts,
      );
    return;
  }

  const isFlex = item.style.display === "flex";
  const direction = flexDirection(item);
  const flowChildren = item.children.filter((child) => !isOutOfFlow(child));
  const gap = isFlex
    ? (length(
        item.style[direction === "row" ? "columnGap" : "rowGap"] ??
          item.style.gap,
      ) ?? 0)
    : 0;
  const explicitWidth =
    forcedWidth ??
    dimension(item.style.width, availableWidth) ??
    (item.type === "page" ? PAGE_WIDTH : undefined);
  for (const child of flowChildren) {
    computeWidth(
      child,
      direction === "column" ? availableWidth : undefined,
      undefined,
      containingWidth,
      viewportWidth,
      fonts,
    );
  }

  const horizontalPadding = item.padding.left + item.padding.right;
  const flowWidth =
    direction === "row"
      ? flowChildren.reduce((sum, child) => sum + outerWidth(child), 0) +
        gap * Math.max(0, flowChildren.length - 1)
      : flowChildren.reduce(
          (max, child) => Math.max(max, outerWidth(child)),
          0,
        );
  item.width = Math.max(0, explicitWidth ?? flowWidth + horizontalPadding);
  item.widthMode = explicitWidth === undefined ? "intrinsic" : "constrained";
  const innerWidth = Math.max(0, item.width - horizontalPadding);
  const itemPosition = positionType(item);
  const positionedChildWidth =
    itemPosition !== "static" ||
    item.type === "page" ||
    item.type === "document"
      ? innerWidth
      : containingWidth;
  const itemViewportWidth = item.type === "page" ? item.width : viewportWidth;

  if (direction === "row") {
    const sizes = flowChildren.map((child) => {
      if (isFlex && typeof child.style.flex === "number") return 0;
      return (
        (isFlex ? dimension(child.style.flexBasis, innerWidth) : undefined) ??
        outerWidth(child)
      );
    });
    const occupied =
      sizes.reduce((sum, size) => sum + size, 0) +
      gap * Math.max(0, sizes.length - 1);
    const free = innerWidth - occupied;
    const growTotal = isFlex
      ? flowChildren.reduce(
          (sum, child) =>
            sum + number(child.style.flexGrow ?? child.style.flex, 0),
          0,
        )
      : 0;
    const shrinkTotal = isFlex
      ? flowChildren.reduce(
          (sum, child, index) =>
            sum +
            (free < 0
              ? number(child.style.flexShrink, item.type === "page" ? 0 : 1) *
                sizes[index]
              : 0),
          0,
        )
      : 0;
    flowChildren.forEach((child, index) => {
      let width = sizes[index];
      if (free > 0 && growTotal > 0)
        width +=
          (free * number(child.style.flexGrow ?? child.style.flex, 0)) /
          growTotal;
      else if (free < 0 && shrinkTotal > 0)
        width = Math.max(
          0,
          width +
            (free * number(child.style.flexShrink, 1) * sizes[index]) /
              shrinkTotal,
        );
      computeWidth(
        child,
        undefined,
        Math.max(0, width - child.margin.left - child.margin.right),
        positionedChildWidth,
        itemViewportWidth,
        fonts,
      );
    });
  } else {
    flowChildren.forEach((child) => {
      const align = isFlex
        ? (child.style.alignSelf ?? item.style.alignItems ?? "stretch")
        : "stretch";
      const explicitCross = dimension(child.style.width, innerWidth);
      const crossWidth =
        explicitCross ??
        (align === "stretch"
          ? Math.max(0, innerWidth - child.margin.left - child.margin.right)
          : undefined);
      computeWidth(
        child,
        innerWidth,
        crossWidth,
        positionedChildWidth,
        itemViewportWidth,
        fonts,
      );
    });
  }

  for (const child of item.children.filter(isOutOfFlow)) {
    const fixed = positionType(child) === "fixed";
    const childContainingWidth = fixed
      ? itemViewportWidth
      : positionedChildWidth;
    const left = inset(child, "left", childContainingWidth);
    const right = inset(child, "right", childContainingWidth);
    const stretchWidth =
      dimension(child.style.width, childContainingWidth) === undefined &&
      left !== undefined &&
      right !== undefined
        ? Math.max(0, childContainingWidth - left - right)
        : undefined;
    computeWidth(
      child,
      childContainingWidth,
      stretchWidth,
      childContainingWidth,
      itemViewportWidth,
      fonts,
    );
  }
}

function svgLength(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const match = /^\s*(-?(?:\d+\.?\d*|\.\d+))(?:px|pt)?\s*$/.exec(value);
  return match ? Number(match[1]) : undefined;
}

function viewBoxSize(
  value: unknown,
): { width: number; height: number } | undefined {
  if (typeof value !== "string") return undefined;
  const values = value
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  return values.length === 4 &&
    values.every(Number.isFinite) &&
    values[2] > 0 &&
    values[3] > 0
    ? { width: values[2], height: values[3] }
    : undefined;
}

function writeWidthBoxes(item: LayoutItem): void {
  item.layout = {
    xPos: 0,
    yPos: 0,
    width: item.width,
    height: 0,
    contentX: item.padding.left,
    contentY: item.padding.top,
    contentWidth: Math.max(
      0,
      item.width - item.padding.left - item.padding.right,
    ),
    contentHeight: 0,
    ...(item.type === "#text"
      ? {
          textLines: item.textLines ?? [item.value ?? ""],
          lineHeight: number(
            item.style.lineHeight,
            number(item.style.fontSize, 12) * 1.2,
          ),
          textWidthMode: item.textWidthMode,
          ...(item.measuredTextWidth !== undefined
            ? { measuredTextWidth: item.measuredTextWidth }
            : {}),
        }
      : {}),
    ...(item.widthMode ? { widthMode: item.widthMode } : {}),
  };
  item.children.forEach(writeWidthBoxes);
}

function flexDirection(item: LayoutItem): "row" | "column" {
  return item.style.display === "flex" &&
    (item.style.flexDirection === "row" ||
      item.style.flexDirection === "row-reverse")
    ? "row"
    : "column";
}

/** Measures and wraps text after layout-width has assigned each text box a width. */
export function layoutText(
  element: JSXElement,
  fonts: ReadonlyMap<string, TtfFont> = new Map(),
): JSXElement {
  return mapNodes(element, fonts) as JSXElement;
}

function mapNodes(
  value: unknown,
  fonts: ReadonlyMap<string, TtfFont>,
): unknown {
  if (Array.isArray(value)) return value.map((child) => mapNodes(child, fonts));
  if (!isJSXNode(value)) return value;
  const children = Array.isArray(value.children)
    ? value.children.map((child) => mapNodes(child, fonts))
    : mapNodes(value.children, fonts);
  if (value.type !== "#text" || !value.layout) return { ...value, children };

  const text = String(value.props.value ?? "");
  const style = asRecord(value.props.style);
  const fontSize = number(style.fontSize, 12);
  const font = resolveFont(style.fontFamily, fonts, style.fontWeight);
  if (!font) {
    const family =
      typeof style.fontFamily === "string"
        ? style.fontFamily
        : "(missing fontFamily)";
    throw new Error(
      `PDF/A-2u requires an embedded TTF font for every text node; no font matching "${family}" was provided.`,
    );
  }
  const widthOf = (line: string) => measureTextWidth(line, style, fonts);
  const mode = value.layout.textWidthMode ?? "constrained";
  const measuredTextWidth = widthOf(text);
  const vertical =
    style.writingMode === "vertical-rl" || style.writingMode === "vertical-lr";
  const width = vertical
    ? fontSize * 1.2
    : mode === "intrinsic"
      ? measuredTextWidth
      : value.layout.width;
  const textLines = vertical ? [text] : wrapText(text, width, widthOf);
  const lineHeight = number(style.lineHeight, fontSize * 1.2);

  return {
    ...value,
    children,
    layout: {
      ...value.layout,
      width,
      height: Math.max(lineHeight, textLines.length * lineHeight),
      textLines,
      lineHeight,
      measuredTextWidth,
      textWidthMode: mode,
      widthMode: mode,
    },
  };
}

export function measureTextWidth(
  text: string,
  style: Record<string, unknown>,
  fonts: ReadonlyMap<string, TtfFont>,
): number {
  const fontSize = number(style.fontSize, 12);
  const font = resolveFont(style.fontFamily, fonts, style.fontWeight);
  if (!font) {
    const family =
      typeof style.fontFamily === "string"
        ? style.fontFamily
        : "(missing fontFamily)";
    throw new Error(
      `PDF/A-2u requires an embedded TTF font for every text node; no font matching "${family}" was provided.`,
    );
  }
  const glyphCount = Array.from(text).length;
  const letterSpacing = number(style.letterSpacing, 0);
  return (
    (measureTtf(text, font) * fontSize) / font.unitsPerEm +
    Math.max(0, glyphCount - 1) * letterSpacing
  );
}

function measureTtf(text: string, font: TtfFont): number {
  let units = 0;
  for (const character of text) units += font.width(character.codePointAt(0)!);
  return units;
}

export function resolveFont(
  family: unknown,
  fonts: ReadonlyMap<string, TtfFont>,
  weight?: unknown,
): TtfFont | undefined {
  if (typeof family !== "string") return undefined;
  const firstFamily = family
    .split(",", 1)[0]
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .toLowerCase();
  const targetWeight = fontWeightValue(weight);
  let nearest: TtfFont | undefined;
  let nearestDistance = Infinity;
  for (const font of fonts.values()) {
    if (font.family.toLowerCase() !== firstFamily) continue;
    const distance = Math.abs(font.weight - targetWeight);
    if (distance < nearestDistance) {
      nearest = font;
      nearestDistance = distance;
    }
  }
  return nearest;
}

export function fontWeightValue(weight: unknown): number {
  if (typeof weight === "number" && Number.isFinite(weight))
    return Math.max(1, Math.min(1000, weight));
  if (weight === "bold") return 600;
  if (typeof weight === "string" && /^\d+$/.test(weight))
    return Math.max(1, Math.min(1000, Number(weight)));
  return 400;
}

function wrapText(
  text: string,
  maxWidth: number,
  widthOf: (text: string) => number,
): string[] {
  if (!text) return [""];
  if (maxWidth <= 0) return [text];
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && widthOf(candidate) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
    if (widthOf(line) > maxWidth) {
      const chunks = splitWord(line, maxWidth, widthOf);
      lines.push(...chunks.slice(0, -1));
      line = chunks.at(-1) ?? "";
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function splitWord(
  word: string,
  maxWidth: number,
  widthOf: (text: string) => number,
): string[] {
  const chunks: string[] = [];
  let chunk = "";
  for (const character of word) {
    if (chunk && widthOf(chunk + character) > maxWidth) {
      chunks.push(chunk);
      chunk = character;
    } else chunk += character;
  }
  if (chunk) chunks.push(chunk);
  return chunks.length ? chunks : [""];
}

/** Resolves block heights, flex growth, and absolute positions after text wrapping. */
export function layoutHeight(element: JSXElement): JSXElement {
  const root = createLayoutItem(element);
  if (!root) return element;
  resolveIntrinsicWidths(root);
  const hasExplicitPages =
    root.type === "document" &&
    root.children.some((child) => child.type === "page");
  const rootHeight = hasExplicitPages
    ? dimension(root.style.height)
    : (dimension(root.style.height, PAGE_HEIGHT) ?? PAGE_HEIGHT);
  const rootWidth = root.width;
  const viewportHeight = PAGE_HEIGHT;
  computeHeight(
    root,
    undefined,
    rootHeight,
    rootHeight ?? viewportHeight,
    viewportHeight,
  );
  place(
    root,
    0,
    0,
    { x: 0, y: 0, width: rootWidth, height: rootHeight ?? viewportHeight },
    { x: 0, y: 0, width: rootWidth, height: viewportHeight },
  );
  return toElement(root) as JSXNode;
}

/** Runs normalization, layout, text measurement, glyph collection, and pagination. */
export async function layout(
  element: JSXElement,
  fonts: ReadonlyMap<string, TtfFont>,
  context: PdfDocumentContext,
): Promise<JSXNode[]> {
  const layoutBatch = async (batch: JSXElement): Promise<JSXNode[]> => {
    const normalized = normalize(batch);
    await yieldToEventLoop();
    const widthLayout = layoutWidth(normalized, fonts);
    await yieldToEventLoop();
    const measuredText = layoutText(widthLayout, fonts);
    await yieldToEventLoop();
    const finalLayout = layoutHeight(measuredText);
    collectPdfGlyphs(finalLayout, fonts);
    await yieldToEventLoop();
    return paginate(finalLayout);
  };

  const { root, authoredPages } = context;
  if (root?.type !== "document" || authoredPages.length === 0)
    return layoutBatch(element);

  const documentFixed = (
    Array.isArray(root.children) ? root.children : [root.children]
  ).filter(
    (child) =>
      isJSXNode(child) && asRecord(child.props.style).position === "fixed",
  );
  const pages: JSXNode[] = [];
  const pageBatchSize = 50;
  for (let start = 0; start < authoredPages.length; start += pageBatchSize) {
    const batchRoot = {
      ...root,
      children: [
        ...documentFixed,
        ...authoredPages.slice(start, start + pageBatchSize),
      ],
    };
    for (const page of await layoutBatch(batchRoot)) pages.push(page);
    await yieldToEventLoop();
  }
  return pages;
}

function resolveIntrinsicWidths(item: LayoutItem): void {
  item.children.forEach(resolveIntrinsicWidths);
  if (item.type === "#text") {
    item.widthMode ??= item.textWidthMode;
    return;
  }
  const direction = flexDirection(item);
  if (item.type === "#group") {
    item.width = item.children.reduce(
      (max, child) => Math.max(max, child.width),
      0,
    );
    return;
  }
  if (item.widthMode !== "intrinsic") return;
  const gap =
    item.style.display === "flex"
      ? (length(
          item.style[direction === "row" ? "columnGap" : "rowGap"] ??
            item.style.gap,
        ) ?? 0)
      : 0;
  const flowChildren = item.children.filter((child) => !isOutOfFlow(child));
  const flowWidth =
    direction === "row"
      ? flowChildren.reduce((sum, child) => sum + outerWidth(child), 0) +
        gap * Math.max(0, flowChildren.length - 1)
      : flowChildren.reduce(
          (max, child) => Math.max(max, outerWidth(child)),
          0,
        );
  item.width = flowWidth + item.padding.left + item.padding.right;
}

function computeHeight(
  item: LayoutItem,
  availableHeight?: number,
  forcedHeight?: number,
  containingHeight = PAGE_HEIGHT,
  viewportHeight = PAGE_HEIGHT,
): void {
  if (item.type === "table") {
    const rows = item.children;
    for (const row of rows)
      computeHeight(
        row,
        availableHeight,
        undefined,
        containingHeight,
        viewportHeight,
      );
    const rowHeights = rows.map((row) => outerHeight(row));
    rows.forEach((row, rowIndex) => {
      for (const cell of row.children) {
        const rowSpan = Math.max(1, number(cell.props.rowSpan, 1));
        if (rowSpan <= 1) continue;
        const spanHeight = rowHeights
          .slice(rowIndex, rowIndex + rowSpan)
          .reduce((sum, height) => sum + height, 0);
        cell.height = Math.max(cell.height, spanHeight);
      }
    });
    item.height =
      forcedHeight ??
      dimension(item.style.height, availableHeight) ??
      rowHeights.reduce((sum, height) => sum + height, 0);
    return;
  }
  if (item.type === "img") {
    const imageWidth = number(asRecord(item.props.image).width, 0);
    const imageHeight = number(asRecord(item.props.image).height, 0);
    const aspectHeight =
      imageWidth > 0 ? (item.width * imageHeight) / imageWidth : 0;
    item.height =
      forcedHeight ??
      dimension(item.style.height, availableHeight) ??
      dimension(item.props.height, availableHeight) ??
      aspectHeight;
    return;
  }
  if (item.type === "svg") {
    const sourceWidth = svgLength(item.props.width) ?? item.width;
    const sourceHeight = svgLength(item.props.height) ?? 0;
    const heightFromViewBox = (() => {
      const raw = item.props.viewBox;
      if (typeof raw !== "string") return 0;
      const parts = raw
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      return parts.length === 4 && parts.every(Number.isFinite) ? parts[3] : 0;
    })();
    const intrinsicHeight = sourceHeight || heightFromViewBox;
    item.height =
      forcedHeight ??
      dimension(item.style.height, availableHeight) ??
      dimension(item.props.height, availableHeight) ??
      (sourceWidth > 0 ? (item.width * intrinsicHeight) / sourceWidth : 0);
    return;
  }
  if (item.type === "#text") {
    const fontSize = number(item.style.fontSize, 12);
    const lineHeight = number(item.style.lineHeight, fontSize * 1.2);
    const vertical =
      item.style.writingMode === "vertical-rl" ||
      item.style.writingMode === "vertical-lr";
    item.height =
      forcedHeight ??
      dimension(item.style.height, availableHeight) ??
      (vertical
        ? Array.from(item.value ?? "").length * lineHeight
        : Math.max(lineHeight, (item.textLines?.length ?? 1) * lineHeight));
    return;
  }
  if (item.type === "#group") {
    item.children.forEach((child) =>
      computeHeight(
        child,
        availableHeight,
        undefined,
        containingHeight,
        viewportHeight,
      ),
    );
    item.height = item.children.reduce(
      (sum, child) => sum + outerHeight(child),
      0,
    );
    return;
  }

  if (item.style.display === "grid") {
    const children = item.children.filter((child) => !isOutOfFlow(child));
    const columns = gridColumns(item);
    const rows = Math.max(1, Math.ceil(children.length / columns.length));
    for (const child of children)
      computeHeight(
        child,
        availableHeight,
        undefined,
        containingHeight,
        viewportHeight,
      );
    const rowHeights = Array.from({ length: rows }, () => 0);
    children.forEach((child, index) => {
      rowHeights[Math.floor(index / columns.length)] = Math.max(
        rowHeights[Math.floor(index / columns.length)],
        outerHeight(child),
      );
    });
    const rowGap = length(item.style.rowGap ?? item.style.gap) ?? 0;
    const naturalHeight =
      rowHeights.reduce((sum, height) => sum + height, 0) +
      rowGap * Math.max(0, rows - 1) +
      item.padding.top +
      item.padding.bottom;
    item.height =
      forcedHeight ??
      dimension(item.style.height, availableHeight) ??
      naturalHeight;
    for (const child of item.children.filter(isOutOfFlow))
      computeHeight(
        child,
        containingHeight,
        undefined,
        containingHeight,
        viewportHeight,
      );
    return;
  }

  const isFlex = item.style.display === "flex";
  const direction = flexDirection(item);
  const flowChildren = item.children.filter((child) => !isOutOfFlow(child));
  const gap = isFlex
    ? (length(
        item.style[direction === "row" ? "columnGap" : "rowGap"] ??
          item.style.gap,
      ) ?? 0)
    : 0;
  const explicitHeight =
    forcedHeight ??
    dimension(item.style.height, availableHeight) ??
    (item.type === "page" ? PAGE_HEIGHT : undefined);
  const itemViewportHeight =
    item.type === "page" ? (explicitHeight ?? PAGE_HEIGHT) : viewportHeight;
  for (const child of flowChildren) {
    const childContainingHeight =
      positionType(item) !== "static" ||
      item.type === "page" ||
      item.type === "document"
        ? Math.max(
            0,
            (explicitHeight ?? availableHeight ?? itemViewportHeight) -
              item.padding.top -
              item.padding.bottom,
          )
        : containingHeight;
    computeHeight(
      child,
      direction === "column" ? availableHeight : undefined,
      undefined,
      childContainingHeight,
      itemViewportHeight,
    );
  }

  const verticalPadding = item.padding.top + item.padding.bottom;
  const flowHeight =
    direction === "column"
      ? flowChildren.reduce((sum, child) => sum + outerHeight(child), 0) +
        gap * Math.max(0, flowChildren.length - 1)
      : flowChildren.reduce(
          (max, child) => Math.max(max, outerHeight(child)),
          0,
        );
  item.height = Math.max(0, explicitHeight ?? flowHeight + verticalPadding);
  const innerHeight = Math.max(0, item.height - verticalPadding);
  const mainSizes = flowChildren.map((child) => {
    if (direction === "row") return outerWidth(child);
    if (isFlex && typeof child.style.flex === "number") return 0;
    return (
      (isFlex ? dimension(child.style.flexBasis, innerHeight) : undefined) ??
      outerHeight(child)
    );
  });
  const occupied =
    mainSizes.reduce((sum, size) => sum + size, 0) +
    gap * Math.max(0, item.children.length - 1);
  const mainAvailable =
    direction === "row"
      ? item.width - item.padding.left - item.padding.right
      : innerHeight;
  const freeSpace = mainAvailable - occupied;
  const growTotal = isFlex
    ? flowChildren.reduce(
        (sum, child) =>
          sum + number(child.style.flexGrow ?? child.style.flex, 0),
        0,
      )
    : 0;
  const shrinkTotal = isFlex
    ? flowChildren.reduce(
        (sum, child, index) =>
          sum +
          (freeSpace < 0
            ? number(child.style.flexShrink, item.type === "page" ? 0 : 1) *
              mainSizes[index]
            : 0),
        0,
      )
    : 0;

  flowChildren.forEach((child, index) => {
    let mainSize = mainSizes[index];
    const grow = number(child.style.flexGrow ?? child.style.flex, 0);
    if (freeSpace > 0 && growTotal > 0)
      mainSize += (freeSpace * grow) / growTotal;
    else if (freeSpace < 0 && shrinkTotal > 0)
      mainSize = Math.max(
        0,
        mainSize +
          (freeSpace * number(child.style.flexShrink, 1) * mainSizes[index]) /
            shrinkTotal,
      );

    if (direction === "row") {
      const explicitCross = dimension(child.style.height);
      const align = isFlex
        ? (child.style.alignSelf ?? item.style.alignItems ?? "stretch")
        : "stretch";
      const crossSize =
        explicitCross ??
        (align === "stretch"
          ? Math.max(0, innerHeight - child.margin.top - child.margin.bottom)
          : undefined);
      computeHeight(
        child,
        undefined,
        crossSize,
        containingHeight,
        itemViewportHeight,
      );
    } else {
      const assignedHeight =
        grow > 0
          ? mainSize - child.margin.top - child.margin.bottom
          : dimension(child.style.height);
      computeHeight(
        child,
        innerHeight,
        assignedHeight,
        containingHeight,
        itemViewportHeight,
      );
    }
  });

  if (explicitHeight === undefined) {
    const resolvedFlowHeight =
      direction === "column"
        ? flowChildren.reduce((sum, child) => sum + outerHeight(child), 0) +
          gap * Math.max(0, flowChildren.length - 1)
        : flowChildren.reduce(
            (max, child) => Math.max(max, outerHeight(child)),
            0,
          );
    item.height = resolvedFlowHeight + verticalPadding;
  }

  const positionedChildHeight =
    positionType(item) !== "static" ||
    item.type === "page" ||
    item.type === "document"
      ? Math.max(0, item.height - verticalPadding)
      : containingHeight;
  for (const child of item.children.filter(isOutOfFlow)) {
    const fixed = positionType(child) === "fixed";
    const childContainingHeight = fixed
      ? itemViewportHeight
      : positionedChildHeight;
    const top = inset(child, "top", childContainingHeight);
    const bottom = inset(child, "bottom", childContainingHeight);
    const stretchHeight =
      dimension(child.style.height, childContainingHeight) === undefined &&
      top !== undefined &&
      bottom !== undefined
        ? Math.max(0, childContainingHeight - top - bottom)
        : undefined;
    computeHeight(
      child,
      childContainingHeight,
      stretchHeight,
      childContainingHeight,
      itemViewportHeight,
    );
  }
}

type Rect = { x: number; y: number; width: number; height: number };

function place(
  item: LayoutItem,
  x: number,
  y: number,
  containingBlock: Rect,
  viewport: Rect,
): void {
  const position = positionType(item);
  if (position === "relative") {
    const left = inset(item, "left", containingBlock.width);
    const right = inset(item, "right", containingBlock.width);
    const top = inset(item, "top", containingBlock.height);
    const bottom = inset(item, "bottom", containingBlock.height);
    x += left ?? (right === undefined ? 0 : -right);
    y += top ?? (bottom === undefined ? 0 : -bottom);
  }
  item.x = x;
  item.y = y;
  item.layout = {
    xPos: x,
    yPos: y,
    width: item.width,
    height: item.height,
    contentX: x + item.padding.left,
    contentY: y + item.padding.top,
    contentWidth: Math.max(
      0,
      item.width - item.padding.left - item.padding.right,
    ),
    contentHeight: Math.max(
      0,
      item.height - item.padding.top - item.padding.bottom,
    ),
    ...(item.textLines
      ? {
          textLines: item.textLines,
          lineHeight: number(
            item.style.lineHeight,
            number(item.style.fontSize, 12) * 1.2,
          ),
          ...(item.textWidthMode ? { textWidthMode: item.textWidthMode } : {}),
          ...(item.measuredTextWidth !== undefined
            ? { measuredTextWidth: item.measuredTextWidth }
            : {}),
        }
      : {}),
    ...(item.widthMode ? { widthMode: item.widthMode } : {}),
  };

  const contentRect = {
    x: x + item.padding.left,
    y: y + item.padding.top,
    width: Math.max(0, item.width - item.padding.left - item.padding.right),
    height: Math.max(0, item.height - item.padding.top - item.padding.bottom),
  };
  const childContainingBlock =
    position !== "static" || item.type === "page" || item.type === "document"
      ? contentRect
      : containingBlock;
  const childViewport =
    item.type === "page"
      ? { x, y, width: item.width, height: item.height }
      : viewport;

  if (item.style.display === "grid") {
    const children = item.children.filter((child) => !isOutOfFlow(child));
    const columns = gridColumns(item);
    const rows = Math.max(1, Math.ceil(children.length / columns.length));
    const rowHeights = Array.from({ length: rows }, () => 0);
    children.forEach((child, index) => {
      rowHeights[Math.floor(index / columns.length)] = Math.max(
        rowHeights[Math.floor(index / columns.length)],
        outerHeight(child),
      );
    });
    const columnGap = length(item.style.columnGap ?? item.style.gap) ?? 0;
    const rowGap = length(item.style.rowGap ?? item.style.gap) ?? 0;
    const columnPositions: number[] = [];
    let cx = x + item.padding.left;
    columns.forEach((width) => {
      columnPositions.push(cx);
      cx += width + columnGap;
    });
    const rowPositions: number[] = [];
    let cy = y + item.padding.top;
    rowHeights.forEach((height) => {
      rowPositions.push(cy);
      cy += height + rowGap;
    });
    children.forEach((child, index) => {
      const col = index % columns.length,
        row = Math.floor(index / columns.length);
      place(
        child,
        columnPositions[col] + child.margin.left,
        rowPositions[row] + child.margin.top,
        childContainingBlock,
        childViewport,
      );
    });
    placePositionedChildren(item, childContainingBlock, childViewport);
    return;
  }

  if (item.type === "#group") {
    let cursorY = y;
    for (const child of item.children) {
      if (isOutOfFlow(child)) continue;
      place(
        child,
        x + child.margin.left,
        cursorY + child.margin.top,
        childContainingBlock,
        childViewport,
      );
      cursorY += outerHeight(child);
    }
    placePositionedChildren(item, childContainingBlock, childViewport);
    return;
  }

  const row = flexDirection(item) === "row";
  const children = item.children.filter((child) => !isOutOfFlow(child));
  const orderedChildren =
    item.style.flexDirection === "row-reverse" ||
    item.style.flexDirection === "column-reverse"
      ? [...children].reverse()
      : children;
  const gap =
    item.style.display === "flex"
      ? (length(item.style[row ? "columnGap" : "rowGap"] ?? item.style.gap) ??
        0)
      : 0;
  const startX = x + item.padding.left;
  const startY = y + item.padding.top;
  const innerMain = row ? item.layout.contentWidth : item.layout.contentHeight;
  const occupied =
    orderedChildren.reduce(
      (sum, child) => sum + (row ? outerWidth(child) : outerHeight(child)),
      0,
    ) +
    gap * Math.max(0, orderedChildren.length - 1);
  const remaining = Math.max(0, innerMain - occupied);
  const justify =
    item.style.display === "flex"
      ? String(item.style.justifyContent ?? "flex-start")
      : "flex-start";
  let cursor = row ? startX : startY;
  if (justify === "center") cursor += remaining / 2;
  else if (justify === "flex-end" || justify === "end") cursor += remaining;
  const between =
    justify === "space-between" && orderedChildren.length > 1
      ? remaining / (orderedChildren.length - 1)
      : 0;
  const alignItems =
    item.style.display === "flex"
      ? String(item.style.alignItems ?? "stretch")
      : "stretch";

  for (const child of orderedChildren) {
    const align = String(child.style.alignSelf ?? alignItems);
    if (row) {
      const crossSpace = item.layout.contentHeight - outerHeight(child);
      const childY =
        startY +
        child.margin.top +
        (align === "center"
          ? crossSpace / 2
          : align === "flex-end"
            ? crossSpace
            : 0);
      place(
        child,
        cursor + child.margin.left,
        childY,
        childContainingBlock,
        childViewport,
      );
      cursor += outerWidth(child) + gap + between;
    } else {
      const crossSpace = item.layout.contentWidth - outerWidth(child);
      const childX =
        startX +
        child.margin.left +
        (align === "center"
          ? crossSpace / 2
          : align === "flex-end"
            ? crossSpace
            : 0);
      place(
        child,
        childX,
        cursor + child.margin.top,
        childContainingBlock,
        childViewport,
      );
      cursor += outerHeight(child) + gap + between;
    }
  }
  placePositionedChildren(item, childContainingBlock, childViewport);
}

function placePositionedChildren(
  item: LayoutItem,
  containingBlock: Rect,
  viewport: Rect,
): void {
  for (const child of item.children.filter(isOutOfFlow)) {
    const fixed = positionType(child) === "fixed";
    const positionedParent = positionType(item) !== "static";
    const rect = fixed
      ? viewport
      : positionedParent
        ? {
            x: item.layout?.xPos ?? containingBlock.x,
            y: item.layout?.yPos ?? containingBlock.y,
            width: item.width,
            height: item.height,
          }
        : containingBlock;
    const left = inset(child, "left", rect.width);
    const right = inset(child, "right", rect.width);
    const top = inset(child, "top", rect.height);
    const bottom = inset(child, "bottom", rect.height);
    const x =
      rect.x +
      (left ?? (right === undefined ? 0 : rect.width - right - child.width));
    const y =
      rect.y +
      (top ?? (bottom === undefined ? 0 : rect.height - bottom - child.height));
    place(child, x, y, rect, viewport);
  }
}

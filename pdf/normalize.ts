import { fragment } from "../jsx/fragment";
import type { JSXElement, JSXNode } from "../jsx/jsx";

const edges = ["Top", "Right", "Bottom", "Left"] as const;
const borderEdges = ["Top", "Right", "Bottom", "Left"] as const;
const namedColors: Record<string, string> = {
  aliceblue: "#f0f8ff", antiquewhite: "#faebd7", aqua: "#00ffff", aquamarine: "#7fffd4", azure: "#f0ffff",
  beige: "#f5f5dc", bisque: "#ffe4c4", black: "#000000", blanchedalmond: "#ffebcd", blue: "#0000ff",
  blueviolet: "#8a2be2", brown: "#a52a2a", burlywood: "#deb887", cadetblue: "#5f9ea0", chartreuse: "#7fff00",
  chocolate: "#d2691e", coral: "#ff7f50", cornflowerblue: "#6495ed", cornsilk: "#fff8dc", crimson: "#dc143c",
  cyan: "#00ffff", darkblue: "#00008b", darkcyan: "#008b8b", darkgoldenrod: "#b8860b", darkgray: "#a9a9a9",
  darkgreen: "#006400", darkgrey: "#a9a9a9", darkkhaki: "#bdb76b", darkmagenta: "#8b008b", darkolivegreen: "#556b2f",
  darkorange: "#ff8c00", darkorchid: "#9932cc", darkred: "#8b0000", darksalmon: "#e9967a", darkseagreen: "#8fbc8f",
  darkslateblue: "#483d8b", darkslategray: "#2f4f4f", darkslategrey: "#2f4f4f", darkturquoise: "#00ced1",
  darkviolet: "#9400d3", deeppink: "#ff1493", deepskyblue: "#00bfff", dimgray: "#696969", dimgrey: "#696969",
  dodgerblue: "#1e90ff", firebrick: "#b22222", floralwhite: "#fffaf0", forestgreen: "#228b22", fuchsia: "#ff00ff",
  gainsboro: "#dcdcdc", ghostwhite: "#f8f8ff", gold: "#ffd700", goldenrod: "#daa520", gray: "#808080", green: "#008000",
  greenyellow: "#adff2f", grey: "#808080", honeydew: "#f0fff0", hotpink: "#ff69b4", indianred: "#cd5c5c",
  indigo: "#4b0082", ivory: "#fffff0", khaki: "#f0e68c", lavender: "#e6e6fa", lavenderblush: "#fff0f5",
  lawngreen: "#7cfc00", lemonchiffon: "#fffacd", lightblue: "#add8e6", lightcoral: "#f08080", lightcyan: "#e0ffff",
  lightgoldenrodyellow: "#fafad2", lightgray: "#d3d3d3", lightgreen: "#90ee90", lightgrey: "#d3d3d3", lightpink: "#ffb6c1",
  lightsalmon: "#ffa07a", lightseagreen: "#20b2aa", lightskyblue: "#87cefa", lightslategray: "#778899", lightslategrey: "#778899",
  lightsteelblue: "#b0c4de", lightyellow: "#ffffe0", lime: "#00ff00", limegreen: "#32cd32", linen: "#faf0e6",
  magenta: "#ff00ff", maroon: "#800000", mediumaquamarine: "#66cdaa", mediumblue: "#0000cd", mediumorchid: "#ba55d3",
  mediumpurple: "#9370db", mediumseagreen: "#3cb371", mediumslateblue: "#7b68ee", mediumspringgreen: "#00fa9a",
  mediumturquoise: "#48d1cc", mediumvioletred: "#c71585", midnightblue: "#191970", mintcream: "#f5fffa", mistyrose: "#ffe4e1",
  moccasin: "#ffe4b5", navajowhite: "#ffdead", navy: "#000080", oldlace: "#fdf5e6", olive: "#808000", olivedrab: "#6b8e23",
  orange: "#ffa500", orangered: "#ff4500", orchid: "#da70d6", palegoldenrod: "#eee8aa", palegreen: "#98fb98",
  paleturquoise: "#afeeee", palevioletred: "#db7093", papayawhip: "#ffefd5", peachpuff: "#ffdab9", peru: "#cd853f",
  pink: "#ffc0cb", plum: "#dda0dd", powderblue: "#b0e0e6", purple: "#800080", rebeccapurple: "#663399",
  red: "#ff0000", rosybrown: "#bc8f8f", royalblue: "#4169e1", saddlebrown: "#8b4513", salmon: "#fa8072",
  sandybrown: "#f4a460", seagreen: "#2e8b57", seashell: "#fff5ee", sienna: "#a0522d", silver: "#c0c0c0",
  skyblue: "#87ceeb", slateblue: "#6a5acd", slategray: "#708090", slategrey: "#708090", snow: "#fffafa",
  springgreen: "#00ff7f", steelblue: "#4682b4", tan: "#d2b48c", teal: "#008080", thistle: "#d8bfd8",
  tomato: "#ff6347", turquoise: "#40e0d0", violet: "#ee82ee", wheat: "#f5deb3", white: "#ffffff", whitesmoke: "#f5f5f5",
  yellow: "#ffff00", yellowgreen: "#9acd32", transparent: "transparent",
};

/** Adds layout defaults, expands spacing and border shorthands, and resolves named colors. */
export function normalize(element: JSXElement): JSXElement {
  if (Array.isArray(element)) {
    return normalizeChildren(element) as JSXElement;
  }

  if (!isJSXNode(element)) {
    return normalizeTextWhitespace(element);
  }

  let children = Array.isArray(element.children)
    ? normalizeChildren(element.children)
    : normalize(element.children as JSXElement);

  if (element.type === fragment) {
    return { ...element, children } as JSXNode;
  }

  const style = asStyle(element.props.style);
  let type = element.type;
  let props = element.props;
  if (type === "ol" || type === "ul") {
    let index = 0;
    children = (Array.isArray(children) ? children : [children]).map((child) => {
      if (!isJSXNode(child) || child.type !== "li") return child;
      const marker = type === "ol" ? `${++index}. ` : "• ";
      return {
        ...child,
        props: { ...child.props, listMarker: marker, style: { display: "flex", flexDirection: "row", ...(asStyle(child.props.style)) } },
      };
    });
    props = { ...element.props, style: { ...style, display: "flex", flexDirection: "column", paddingLeft: style.paddingLeft ?? 18 } };
  }
  if (type === "li") {
    props = { ...element.props, style: { ...style, display: "flex", flexDirection: "row" } };
  }
  if (type === "table") {
    type = "table";
    const columns = Array.isArray(element.props.columns) ? element.props.columns : [];
    const occupiedUntil: number[] = [];
    children = (Array.isArray(children) ? children : [children]).map((row, rowIndex) => {
      if (!isJSXNode(row) || (row.type !== "tr" && row.type !== "table-row")) return row;
      let columnIndex = 0;
      let previousCellEnd = 0;
      const cells = (Array.isArray(row.children) ? row.children : [row.children]).map((cell) => {
        if (!isJSXNode(cell) || (cell.type !== "td" && cell.type !== "th" && cell.type !== "table-cell")) return cell;
        while ((occupiedUntil[columnIndex] ?? 0) > rowIndex) columnIndex++;
        const startColumn = columnIndex;
        const skippedWidth = columns.slice(previousCellEnd, startColumn).reduce((sum, width) => sum + (typeof width === "number" ? width : 0), 0);
        const colSpan = Math.max(1, Math.floor(Number(cell.props.colSpan ?? cell.props.colspan ?? 1)) || 1);
        const rowSpan = Math.max(1, Math.floor(Number(cell.props.rowSpan ?? cell.props.rowspan ?? 1)) || 1);
        for (let column = startColumn; column < startColumn + colSpan; column++) {
          if (rowSpan > 1) occupiedUntil[column] = rowIndex + rowSpan;
        }
        columnIndex += colSpan;
        previousCellEnd = columnIndex;
        const spanWidths = columns.slice(startColumn, startColumn + colSpan);
        const columnWidth = spanWidths.length === colSpan && spanWidths.every((width) => typeof width === "number")
          ? spanWidths.reduce((sum, width) => sum + Number(width), 0)
          : undefined;
        const cellStyle = asStyle(cell.props.style);
        const cellBorder = parseBorder(cellStyle.border) ?? parseBorder("0.5pt solid #d0d5dd")!;
        const padding = cellStyle.padding ?? 6;
        const paddingTop = cellStyle.paddingTop || cellStyle.paddingVertical || padding;
        const paddingRight = cellStyle.paddingRight || cellStyle.paddingHorizontal || padding;
        const paddingBottom = cellStyle.paddingBottom || cellStyle.paddingVertical || padding;
        const paddingLeft = cellStyle.paddingLeft || cellStyle.paddingHorizontal || padding;
        return {
          ...cell,
          type: "table-cell",
          props: {
            ...cell.props,
            columnStart: startColumn,
            colSpan,
            rowSpan,
            style: {
              ...cellStyle,
              ...(cellStyle.width === undefined && typeof columnWidth === "number" ? { width: columnWidth } : {}),
              ...(cellStyle.width === undefined && typeof columnWidth !== "number" ? { flex: colSpan } : {}),
              marginLeft: cellStyle.marginLeft && cellStyle.marginLeft !== 0 ? cellStyle.marginLeft : skippedWidth,
              padding: 0,
              paddingTop,
              paddingRight,
              paddingBottom,
              paddingLeft,
              border: cellStyle.border ?? "0.5pt solid #d0d5dd",
              borderColor: cellStyle.borderColor ?? cellBorder.color,
              borderTopColor: cellStyle.borderColor ?? cellBorder.color,
              borderRightColor: cellStyle.borderColor ?? cellBorder.color,
              borderBottomColor: cellStyle.borderColor ?? cellBorder.color,
              borderLeftColor: cellStyle.borderColor ?? cellBorder.color,
              borderTopWidth: cellStyle.borderTopWidth || cellStyle.borderWidth || cellBorder.width,
              borderRightWidth: cellStyle.borderRightWidth || cellStyle.borderWidth || cellBorder.width,
              borderBottomWidth: cellStyle.borderBottomWidth || cellStyle.borderWidth || cellBorder.width,
              borderLeftWidth: cellStyle.borderLeftWidth || cellStyle.borderWidth || cellBorder.width,
              ...(cell.type === "th" ? { fontWeight: cellStyle.fontWeight ?? "bold", backgroundColor: cellStyle.backgroundColor ?? "#f2f4f7" } : {}),
            },
          },
        };
      });
      return {
        ...row,
        type: "table-row",
        props: {
          ...row.props,
          tableHeader: (Array.isArray(row.children) ? row.children : [row.children]).some((cell) => isJSXNode(cell) && cell.type === "th"),
          style: { ...asStyle(row.props.style), display: "flex", flexDirection: "row" },
        },
        children: cells,
      };
    });
    props = {
      ...element.props,
      style: { ...style, width: style.width ?? "100%", flexDirection: "column" },
    };
  }
  const normalizedBorders = normalizeBorders(style);
  const normalizedStyle: Record<string, unknown> = {
    ...(type === "table" || type === "ol" || type === "ul" || type === "li" ? asStyle(props.style) : style),
    ...normalizeEdges(style, "margin", element.props),
    ...normalizeEdges(style, "padding", element.props),
    ...normalizedBorders,
    backgroundColor: normalizeColor(style.backgroundColor ?? element.props.backgroundColor ?? "white"),
    color: normalizeColor(style.color ?? element.props.color ?? "black"),
  };

  return {
    ...element,
    type,
    props: { ...props, style: normalizedStyle },
    children,
  } as JSXNode;
}

function normalizeBorders(style: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const shorthand = parseBorder(style.border);
  for (const edge of borderEdges) {
    const sideShorthand = parseBorder(style[`border${edge}`]) ?? shorthand;
    const width = style[`border${edge}Width`] ?? style.borderWidth ?? sideShorthand?.width ?? 0;
    const color = style[`border${edge}Color`] ?? style.borderColor ?? sideShorthand?.color ?? "black";
    const lineStyle = style[`border${edge}Style`] ?? style.borderStyle ?? sideShorthand?.style ?? "solid";
    result[`border${edge}Width`] = parseLength(width);
    result[`border${edge}Color`] = normalizeColor(color);
    result[`border${edge}Style`] = lineStyle;
  }
  return result;
}

function parseBorder(value: unknown): { width: number; style: string; color: string } | undefined {
  if (typeof value !== "string") return undefined;
  let width = 1;
  let lineStyle = "solid";
  let color = "black";
  for (const token of value.trim().split(/\s+/)) {
    if (/^(thin|medium|thick|(?:\d*\.)?\d+(?:pt|px|in|mm|cm)?)$/i.test(token)) width = parseLength(token);
    else if (["none", "hidden", "solid", "dashed", "dotted", "double"].includes(token.toLowerCase())) lineStyle = token.toLowerCase();
    else color = normalizeColor(token) as string;
  }
  return { width, style: lineStyle, color };
}

function parseLength(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const match = value.trim().match(/^([\d.]+)(pt|px|in|mm|cm)?$/i);
  if (!match) return value === "thin" ? 0.5 : value === "medium" ? 1 : value === "thick" ? 2 : 0;
  const amount = Number(match[1]);
  switch ((match[2] ?? "pt").toLowerCase()) {
    case "px": return amount * 0.75;
    case "in": return amount * 72;
    case "mm": return amount * 72 / 25.4;
    case "cm": return amount * 72 / 2.54;
    default: return amount;
  }
}

function normalizeColor(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return namedColors[value.toLowerCase()] ?? value;
}

function normalizeChildren(children: unknown[]): JSXElement[] {
  const normalized = children.map((child) => normalize(child as JSXElement));
  const result: unknown[] = [];

  for (const child of normalized) {
    if (typeof child === "string" || typeof child === "number") {
      const text = String(child);
      const previous = result.at(-1);
      if (typeof previous === "string") result[result.length - 1] = previous + text;
      else result.push(text);
    } else {
      result.push(child);
    }
  }

  return result
    .filter((child) => typeof child !== "string" || !/^\s*$/.test(child) || !/[\r\n]/.test(child))
    .map((child) => typeof child === "string" ? child.replace(/\s+/g, " ") : child) as unknown as JSXElement[];
}

/** Collapse formatting whitespace from multiline JSX into ordinary spaces. */
function normalizeTextWhitespace(value: unknown): JSXElement {
  if (typeof value !== "string") return value as JSXElement;
  return value.replace(/\s+/g, " ");
}

function normalizeEdges(
  style: Record<string, unknown>,
  property: "margin" | "padding",
  props: Record<string, unknown>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const edge of edges) {
    const side = `${property}${edge}`;
    const axis =
      edge === "Top" || edge === "Bottom" ? "Vertical" : "Horizontal";
    normalized[side] =
      style[side] ??
      props[side] ??
      style[`${property}${axis}`] ??
      props[`${property}${axis}`] ??
      style[property] ??
      props[property] ??
      0;
  }

  return normalized;
}

function asStyle(style: unknown): Record<string, unknown> {
  return typeof style === "object" && style !== null && !Array.isArray(style)
    ? (style as Record<string, unknown>)
    : {};
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

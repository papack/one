import type { JSXNode } from "../jsx/jsx";

export type SvgDocument = {
  type: "svg-document";
  width?: number;
  height?: number;
  viewBox?: string;
  children: unknown[];
};

export function isSvgDocument(value: unknown): value is SvgDocument {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "svg-document"
  );
}

/** Parses the XML subset used by SVG into the same small node shape as JSX. */
export function parseSvg(source: string): SvgDocument {
  if (!/<svg(?:\s|>)/i.test(source))
    throw new Error("The supplied XML does not contain an SVG root element.");
  const tokens =
    source.match(/<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<![^>]*>|<[^>]+>|[^<]+/g) ??
    [];
  const stack: Array<{
    type: string;
    props: Record<string, unknown>;
    children: unknown[];
  }> = [];
  let root: SvgDocument | undefined;
  for (const token of tokens) {
    if (
      token.startsWith("<!--") ||
      token.startsWith("<?") ||
      token.startsWith("<!")
    )
      continue;
    if (token.startsWith("</")) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    if (token.startsWith("<")) {
      const match = /^<([\w:-]+)([\s\S]*?)\/?\s*>$/.exec(token);
      if (!match) continue;
      const name = match[1].split(":").pop()!.toLowerCase();
      const props = parseAttributes(match[2]);
      if (name === "svg" && !root) {
        root = {
          type: "svg-document",
          width: length(props.width),
          height: length(props.height),
          viewBox:
            typeof props.viewBox === "string" ? props.viewBox : undefined,
          children: [],
        };
        stack.push({ type: "svg", props, children: root.children });
      } else if (stack.length) {
        const node = { type: name, props, children: [] as unknown[] };
        stack.at(-1)!.children.push(node satisfies JSXNode);
        if (
          !token.endsWith("/>") &&
          ![
            "path",
            "rect",
            "circle",
            "ellipse",
            "line",
            "polyline",
            "polygon",
            "stop",
            "use",
            "image",
          ].includes(name)
        )
          stack.push(node);
      }
    } else if (stack.length) {
      const text = decodeEntities(token);
      if (text.trim() || ["text", "tspan"].includes(stack.at(-1)!.type))
        stack.at(-1)!.children.push(text);
    }
  }
  if (!root) throw new Error("Could not parse an SVG root element.");
  return root;
}

export function parseAttributes(text: string): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  const pattern = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of text.matchAll(pattern)) {
    const key = match[1].split(":").pop()!;
    const value = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
    props[key] = key === "style" ? parseStyle(value) : value;
  }
  return props;
}

function parseStyle(text: string): Record<string, string> {
  return Object.fromEntries(
    text
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const colon = item.indexOf(":");
        const key = item
          .slice(0, colon)
          .trim()
          .replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
        return [key, item.slice(colon + 1).trim()];
      }),
  );
}

function decodeEntities(value: string): string {
  return value.replace(
    /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,
    (entity, code: string) => {
      if (code[0] === "#")
        return String.fromCodePoint(
          code[1].toLowerCase() === "x"
            ? parseInt(code.slice(2), 16)
            : parseInt(code.slice(1), 10),
        );
      return (
        (
          { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<
            string,
            string
          >
        )[code.toLowerCase()] ?? entity
      );
    },
  );
}

function length(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const match = /^\s*([\d.]+)(?:px|pt)?\s*$/.exec(value);
  return match ? Number(match[1]) : undefined;
}

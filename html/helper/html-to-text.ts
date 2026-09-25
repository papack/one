const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  copy: "©",
  reg: "®",
  trade: "™",
  euro: "€",
  pound: "£",
  yen: "¥",
  cent: "¢",
  sect: "§",
  para: "¶",
  deg: "°",
  plusmn: "±",
  times: "×",
  divide: "÷",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  middot: "·",
  bull: "•",
  laquo: "«",
  raquo: "»",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  ensp: " ",
  emsp: " ",
  thinsp: " ",
  shy: "",
  zwnj: "\u200c",
  zwj: "\u200d",
  auml: "ä",
  ouml: "ö",
  uuml: "ü",
  Auml: "Ä",
  Ouml: "Ö",
  Uuml: "Ü",
  szlig: "ß",
  agrave: "à",
  aacute: "á",
  acirc: "â",
  atilde: "ã",
  aring: "å",
  aelig: "æ",
  egrave: "è",
  eacute: "é",
  ecirc: "ê",
  euml: "ë",
  igrave: "ì",
  iacute: "í",
  icirc: "î",
  iuml: "ï",
  ntilde: "ñ",
  ograve: "ò",
  oacute: "ó",
  ocirc: "ô",
  otilde: "õ",
  oslash: "ø",
  ugrave: "ù",
  uacute: "ú",
  ucirc: "û",
  yacute: "ý",
  yuml: "ÿ",
  ccedil: "ç",
  Agrave: "À",
  Aacute: "Á",
  Acirc: "Â",
  Atilde: "Ã",
  Aring: "Å",
  AElig: "Æ",
  Egrave: "È",
  Eacute: "É",
  Ecirc: "Ê",
  Euml: "Ë",
  Igrave: "Ì",
  Iacute: "Í",
  Icirc: "Î",
  Iuml: "Ï",
  Ntilde: "Ñ",
  Ograve: "Ò",
  Oacute: "Ó",
  Ocirc: "Ô",
  Otilde: "Õ",
  Oslash: "Ø",
  Ugrave: "Ù",
  Uacute: "Ú",
  Ucirc: "Û",
  Yacute: "Ý",
  Ccedil: "Ç",
};

function decode(value: string): string {
  return value.replace(
    /&(#x[\da-f]+|#\d+|[a-z][a-z\d]+);/gi,
    (match, name: string) => {
      if (name[0] !== "#")
        return Object.hasOwn(entities, name) ? entities[name] : match;
      const hex = name[1].toLowerCase() === "x";
      const code = Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
      return code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)
        ? "\ufffd"
        : String.fromCodePoint(code);
    },
  );
}

function attributes(tag: string): Map<string, string> {
  const result = new Map<string, string>();
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of tag.matchAll(pattern)) {
    const name = match[1].toLowerCase();
    if (!result.has(name))
      result.set(name, decode(match[2] ?? match[3] ?? match[4] ?? ""));
  }
  return result;
}

const blocks = new Set(
  "address article aside blockquote div dl dt dd fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr main nav p pre section table ul ol".split(
    " ",
  ),
);
const voids = new Set(
  "area base br col embed hr img input link meta param source track wbr".split(
    " ",
  ),
);
const omitted = new Set(["head", "script", "style", "template", "noscript"]);
const raw = new Set(["script", "style", "textarea", "title"]);

type Frame = {
  tag: string;
  attrs: Map<string, string>;
  hidden: boolean;
  parts: string[];
  next: number;
  marker?: string;
};

/** Convert an HTML string to readable plain text without executing HTML or JSX. */
export function htmlToText(html: string): string {
  const root: Frame = {
    tag: "",
    attrs: new Map(),
    hidden: false,
    parts: [],
    next: 1,
  };
  const stack = [root];
  const current = () => stack[stack.length - 1];
  const append = (text: string) => {
    if (!current().hidden) current().parts.push(text);
  };
  const text = (value: string) =>
    append(decode(value).replace(/[\t\n\r\f ]+/g, " "));

  const close = () => {
    const frame = stack.pop()!;
    if (frame.hidden) return;
    let value = frame.parts.join("");
    if (frame.tag === "a") {
      const href = frame.attrs.get("href")?.trim();
      if (
        href &&
        !href.startsWith("#") &&
        !/^(?:javascript|data|vbscript):/i.test(href)
      ) {
        const target = href.replace(/^(?:mailto|tel):/i, "");
        if (!value.trim()) value = target;
        else if (value.trim() !== target) value += ` (${target})`;
      }
    }
    if (frame.tag === "li") value = `\n${frame.marker}${value.trim()}`;
    else if (frame.tag === "tr") value = `\n${value.trim()}`;
    else if (frame.tag === "td" || frame.tag === "th")
      value = `${value.trim()}\t`;
    else if (blocks.has(frame.tag)) value = `\n\n${value.trim()}\n\n`;
    append(value);
  };

  // Tokenize tags with quoted attributes intact; '<' in ordinary text is retained.
  const tokens =
    /<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\/?[a-z][a-z\d:-]*(?:\s+(?:"[^"]*"|'[^']*'|[^'">])*)?\s*\/?>/gi;
  let offset = 0;
  let match: RegExpExecArray | null;
  while ((match = tokens.exec(html))) {
    text(html.slice(offset, match.index));
    offset = tokens.lastIndex;
    const token = match[0];
    if (token.startsWith("<!")) continue;
    const name = /^<\/?([a-z][a-z\d:-]*)/i.exec(token)!;
    const tag = name[1].toLowerCase();
    if (token[1] === "/") {
      const index = stack.map((frame) => frame.tag).lastIndexOf(tag);
      if (index > 0) while (stack.length > index) close();
      continue;
    }
    // Tolerate common omitted closing tags in lists and paragraphs.
    if ((tag === "li" || tag === "p") && current().tag === tag) close();
    const attrs = attributes(token.slice(name[0].length, -1));
    const hidden =
      current().hidden ||
      omitted.has(tag) ||
      attrs.has("hidden") ||
      /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse))\s*(?:!important\s*)?(?:;|$)/i.test(
        attrs.get("style") ?? "",
      );
    let marker: string | undefined;
    if (tag === "li") {
      const list = stack
        .slice()
        .reverse()
        .find((frame) => frame.tag === "ol" || frame.tag === "ul");
      if (list?.tag === "ol") {
        const value = attrs.get("value");
        if (value && /^-?\d+$/.test(value)) list.next = Number(value);
        marker = `${list.next++}. `;
      } else marker = "- ";
    }
    const start = attrs.get("start") ?? "1";
    const frame: Frame = {
      tag,
      attrs,
      hidden,
      parts: [],
      next: /^-?\d+$/.test(start) ? Number(start) : 1,
      marker,
    };
    if (voids.has(tag)) {
      if (!hidden) {
        if (tag === "br") append("\n");
        else if (tag === "hr") append("\n\n");
        else if (tag === "img") append(attrs.get("alt") ?? "");
      }
      continue;
    }
    stack.push(frame);
    if (raw.has(tag)) {
      const end = new RegExp(`</${tag}\\s*>`, "ig");
      end.lastIndex = offset;
      const closing = end.exec(html);
      text(html.slice(offset, closing?.index ?? html.length));
      offset = closing ? end.lastIndex : html.length;
      tokens.lastIndex = offset;
      close();
    }
  }
  text(html.slice(offset));
  while (stack.length > 1) close();
  return root.parts
    .join("")
    .replace(/ +/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

import type { JSXNode } from "../jsx/jsx";
import { asRecord, isJSXNode } from "./context";
import { isSvgDocument } from "./svg";
import { parseTtfFont, type TtfFont } from "./ttf";

export type FontSource = ArrayBuffer | Uint8Array;
export type FontFamilySource = FontSource | Partial<Record<number, FontSource>>;

export function createFontMap(fonts: Record<string, FontFamilySource> = {}): Map<string, TtfFont> {
  const result = new Map<string, TtfFont>();
  for (const [registeredName, source] of Object.entries(fonts)) {
    if (isFontSource(source)) {
      const legacyFace = splitLegacyFontName(registeredName);
      if (legacyFace) addFont(result, legacyFace.family, legacyFace.weight, source);
      else addFont(result, registeredName, 400, source);
    } else {
      for (const [rawWeight, bytes] of Object.entries(source)) {
        const weight = Number(rawWeight);
        if (!Number.isInteger(weight) || weight < 1 || weight > 1000)
          throw new TypeError(`Invalid font weight "${rawWeight}" for ${registeredName}; expected a number from 1 to 1000.`);
        if (!isFontSource(bytes))
          throw new TypeError(`Font ${registeredName} at weight ${weight} must be an ArrayBuffer or Uint8Array.`);
        addFont(result, registeredName, weight, bytes);
      }
    }
  }
  return result;
}

function addFont(map: Map<string, TtfFont>, family: string, weight: number, source: FontSource): void {
  map.set(`${family.toLowerCase()}|${weight}`, parseTtfFont(family, source, weight));
}

function isFontSource(value: unknown): value is FontSource {
  return value instanceof ArrayBuffer || value instanceof Uint8Array;
}

function splitLegacyFontName(name: string): { family: string; weight: number } | undefined {
  const match = /^(.*?)\s+(bold|normal|[1-9]00)$/i.exec(name);
  if (!match || !match[1].trim()) return undefined;
  return {
    family: match[1].trim(),
    weight: match[2].toLowerCase() === "bold" ? 600 : match[2].toLowerCase() === "normal" ? 400 : Number(match[2]),
  };
}

export function collectPdfImages(value: unknown, images: import("./image").PdfImage[] = []): import("./image").PdfImage[] {
  if (Array.isArray(value)) {
    for (const child of value) collectPdfImages(child, images);
    return images;
  }
  if (!isJSXNode(value)) return images;
  if (value.type === "img" && typeof value.props.image === "object" && value.props.image !== null && !isSvgDocument(value.props.image)) {
    images.push(value.props.image as import("./image").PdfImage);
  }
  const children = Array.isArray(value.children) ? value.children : [value.children];
  for (const child of children) collectPdfImages(child, images);
  return images;
}

export function collectPdfGlyphs(node: unknown, fonts: ReadonlyMap<string, TtfFont>, inheritedFamily = ""): void {
  if (typeof node === "string" || typeof node === "number") {
    const font = resolveNodeFont({ type: "#text", props: { style: { fontFamily: inheritedFamily } }, children: [] }, fonts);
    if (font) for (const character of String(node)) font.collect(character.codePointAt(0)!);
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectPdfGlyphs(child, fonts, inheritedFamily);
    return;
  }
  if (!isJSXNode(node)) return;
  const style = asRecord(node.props.style);
  const family = typeof style.fontFamily === "string"
    ? style.fontFamily
    : node.type === "svg" && typeof node.props.fontFamily === "string"
      ? node.props.fontFamily
      : inheritedFamily;
  const font = resolveNodeFont({ ...node, props: { ...node.props, style: { ...style, fontFamily: family } } }, fonts);
  if (node.type === "#text" && font && (typeof node.props.value === "string" || typeof node.props.value === "number")) {
    for (const character of String(node.props.value)) font.collect(character.codePointAt(0)!);
  }
  if (node.type === "svg") collectSvgGlyphs(node.props.svgChildren ?? node.children, fonts, family, style.fontWeight);
  if (font && (node.type === "page-number" || node.type === "pages-total" || node.props.dynamicText === "pageNumber" || node.props.dynamicText === "pagesTotal")) {
    for (let digit = 0x30; digit <= 0x39; digit++) font.collect(digit);
  }
  const children = Array.isArray(node.children) ? node.children : [node.children];
  for (const child of children) collectPdfGlyphs(child, fonts, family);
}

function collectSvgGlyphs(value: unknown, fonts: ReadonlyMap<string, TtfFont>, inheritedFamily: string, inheritedWeight?: unknown): void {
  if (typeof value === "string" || typeof value === "number") {
    const font = resolveNodeFont({ type: "#text", props: { style: { fontFamily: inheritedFamily, fontWeight: inheritedWeight } }, children: [] }, fonts);
    if (font) for (const character of String(value)) font.collect(character.codePointAt(0)!);
    return;
  }
  if (Array.isArray(value)) { for (const child of value) collectSvgGlyphs(child, fonts, inheritedFamily, inheritedWeight); return; }
  if (!isJSXNode(value)) return;
  const style = asRecord(value.props.style);
  const family = typeof value.props.fontFamily === "string" ? value.props.fontFamily : typeof style.fontFamily === "string" ? style.fontFamily : inheritedFamily;
  const weight = value.props.fontWeight ?? style.fontWeight ?? inheritedWeight;
  const children = Array.isArray(value.children) ? value.children : [value.children];
  for (const child of children) collectSvgGlyphs(child, fonts, family, weight);
}

function resolveNodeFont(node: JSXNode, fonts: ReadonlyMap<string, TtfFont>): TtfFont | undefined {
  const style = asRecord(node.props.style);
  const family = typeof style.fontFamily === "string"
    ? style.fontFamily.split(",", 1)[0].trim().replace(/^['"]|['"]$/g, "").toLowerCase()
    : "";
  if (!family) return undefined;
  const weight = requestedFontWeight(style.fontWeight);
  let nearest: TtfFont | undefined;
  let nearestDistance = Infinity;
  for (const font of fonts.values()) {
    if (font.family.toLowerCase() !== family) continue;
    const distance = Math.abs(font.weight - weight);
    if (distance < nearestDistance) {
      nearest = font;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function requestedFontWeight(weight: unknown): number {
  if (typeof weight === "number" && Number.isFinite(weight)) return Math.max(1, Math.min(1000, weight));
  if (weight === "bold") return 600;
  if (typeof weight === "string" && /^\d+$/.test(weight)) return Math.max(1, Math.min(1000, Number(weight)));
  return 400;
}

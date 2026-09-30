import type { Component, JSXElement, JSXNode } from "../jsx/jsx";
import { loadImage } from "./image";
import { parseSvg } from "./svg";

export async function resolve(element: JSXElement): Promise<JSXElement> {
  return resolveValue(element);
}

async function resolveValue(value: unknown): Promise<any> {
  const resolved = await value;

  if (Array.isArray(resolved)) {
    return Promise.all(resolved.map(resolveValue));
  }

  if (!isJSXNode(resolved)) {
    return resolved;
  }

  const sourceChildren = normalizeChildren(resolved.children).length > 0
    ? resolved.children
    : resolved.props.children;
  const sourceChildList = normalizeChildren(sourceChildren);

  if (typeof resolved.type === "function") {
    const component = resolved.type as Component;
    const output = component({
      ...resolved.props,
      children: sourceChildList,
    });
    return resolveValue(output);
  }

  const children = await Promise.all(sourceChildList.map(resolveValue));
  const { children: _propsChildren, ...props } = resolved.props;
  if (resolved.type === "img") {
    const source = props.src;
    if (typeof source === "string" && /\.svg(?:[?#]|$)/i.test(source)) {
      props.image = parseSvg(new TextDecoder().decode(await loadImageBytes(source)));
    } else if (typeof source === "string" && /^data:image\/svg\+xml/i.test(source)) {
      props.image = parseSvg(decodeSvgDataUrl(source));
    } else props.image = await loadImage(source);
  }

  return {
    type: resolved.type,
    props,
    children,
  } satisfies JSXNode;
}

async function loadImageBytes(source: string): Promise<Uint8Array> {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Failed to load SVG URL (${response.status} ${response.statusText}): ${source}`);
    return new Uint8Array(await response.arrayBuffer());
  }
  const { readFile } = await import("node:fs/promises");
  return new Uint8Array(await readFile(source));
}

function decodeSvgDataUrl(source: string): string {
  const comma = source.indexOf(",");
  if (comma < 0) throw new Error("Invalid SVG data URL.");
  const metadata = source.slice(0, comma);
  const payload = source.slice(comma + 1);
  return /;base64/i.test(metadata) ? atob(payload) : decodeURIComponent(payload);
}

function normalizeChildren(children: unknown): unknown[] {
  if (children === null || children === undefined || typeof children === "boolean") {
    return [];
  }
  return Array.isArray(children) ? children.flat(Infinity) : [children];
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

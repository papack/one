import { readFile } from "node:fs/promises";
import { deflateSync, inflateSync } from "node:zlib";

export type PdfImage = {
  source: "jpeg" | "raster";
  width: number;
  height: number;
  colorSpace: "DeviceRGB" | "DeviceGray";
  bytes: Uint8Array;
  alpha?: Uint8Array;
};

/** Loads an image from a URL, data URL, Node buffer, ArrayBuffer, or filesystem path. */
export async function loadImage(source: unknown): Promise<PdfImage> {
  let bytes: Uint8Array;
  if (source instanceof Uint8Array) bytes = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  else if (source instanceof ArrayBuffer) bytes = new Uint8Array(source);
  else if (typeof Blob !== "undefined" && source instanceof Blob) bytes = new Uint8Array(await source.arrayBuffer());
  else if (source instanceof URL) bytes = await responseBytes(await fetch(source), source.href);
  else if (typeof source === "string") bytes = await loadStringSource(source);
  else throw new TypeError("<img src> must be a URL, data URL, Uint8Array/Buffer, ArrayBuffer, Blob, or file path.");

  if (isJpeg(bytes)) return parseJpeg(bytes);
  if (isPng(bytes)) return parsePng(bytes);
  throw new Error("Unsupported image format. Provide a JPEG or a non-interlaced 8-bit PNG (RGB, RGBA, grayscale, or grayscale-alpha).");
}

async function loadStringSource(source: string): Promise<Uint8Array> {
  if (source.startsWith("data:")) return decodeDataUrl(source);
  if (/^https?:\/\//i.test(source)) {
    return responseBytes(await fetch(source), source);
  }
  return new Uint8Array(await readFile(source));
}

function decodeDataUrl(value: string): Uint8Array {
  const comma = value.indexOf(",");
  if (comma < 0) throw new Error("Invalid image data URL: missing comma separator.");
  const metadata = value.slice(5, comma);
  const payload = value.slice(comma + 1);
  if (/;base64(?:;|$)/i.test(metadata)) {
    const binary = atob(payload.replace(/\s/g, ""));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }
  const chunks: Uint8Array[] = [];
  for (let index = 0; index < payload.length;) {
    if (payload[index] === "%") {
      const hex = payload.slice(index + 1, index + 3);
      if (!/^[\da-f]{2}$/i.test(hex)) throw new Error("Invalid percent escape in image data URL.");
      chunks.push(Uint8Array.of(parseInt(hex, 16)));
      index += 3;
    } else {
      const point = payload.codePointAt(index)!;
      const character = String.fromCodePoint(point);
      chunks.push(new TextEncoder().encode(character));
      index += character.length;
    }
  }
  return concat(chunks);
}

async function responseBytes(response: Response, source: string): Promise<Uint8Array> {
  if (!response.ok) throw new Error(`Failed to load image URL (${response.status} ${response.statusText}): ${source}`);
  return new Uint8Array(await response.arrayBuffer());
}

function isJpeg(bytes: Uint8Array): boolean { return bytes[0] === 0xff && bytes[1] === 0xd8; }
function isPng(bytes: Uint8Array): boolean {
  return bytes.length >= 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10;
}

function parseJpeg(bytes: Uint8Array): PdfImage {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset++; continue; }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = view.getUint16(offset);
    if (offset + length > bytes.length) break;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      const height = view.getUint16(offset + 3);
      const width = view.getUint16(offset + 5);
      const components = view.getUint8(offset + 7);
      if (components !== 1 && components !== 3) throw new Error(`JPEG images with ${components} color components are not supported.`);
      return { source: "jpeg", width, height, colorSpace: components === 1 ? "DeviceGray" : "DeviceRGB", bytes };
    }
    offset += length;
  }
  throw new Error("Could not read JPEG dimensions.");
}

function parsePng(bytes: Uint8Array): PdfImage {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let interlace = 0;
  const idat: Uint8Array[] = [];
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) throw new Error("Invalid PNG: chunk extends beyond end of file.");
    if (type === "IHDR") {
      width = view.getUint32(dataStart);
      height = view.getUint32(dataStart + 4);
      bitDepth = view.getUint8(dataStart + 8);
      colorType = view.getUint8(dataStart + 9);
      interlace = view.getUint8(dataStart + 12);
    } else if (type === "IDAT") idat.push(bytes.subarray(dataStart, dataEnd));
    else if (type === "IEND") break;
    offset = dataEnd + 4;
  }
  const channels: Record<number, number> = { 0: 1, 2: 3, 4: 2, 6: 4 };
  const components = channels[colorType];
  if (!width || !height || bitDepth !== 8 || !components || interlace !== 0) {
    throw new Error("PNG support requires non-interlaced 8-bit grayscale, RGB, RGBA, or grayscale-alpha images.");
  }
  const compressed = concat(idat);
  const scanlines = inflateSync(compressed);
  const stride = width * components;
  const pixels = new Uint8Array(stride * height);
  let sourceOffset = 0;
  for (let y = 0; y < height; y++) {
    const filter = scanlines[sourceOffset++];
    const row = y * stride;
    for (let x = 0; x < stride; x++) {
      const raw = scanlines[sourceOffset++];
      const left = x >= components ? pixels[row + x - components] : 0;
      const above = y > 0 ? pixels[row - stride + x] : 0;
      const upperLeft = y > 0 && x >= components ? pixels[row - stride + x - components] : 0;
      pixels[row + x] = (raw + predictor(filter, left, above, upperLeft)) & 0xff;
    }
  }
  const hasAlpha = colorType === 4 || colorType === 6;
  const colorComponents = colorType === 0 || colorType === 4 ? 1 : 3;
  const raster = new Uint8Array(width * height * colorComponents);
  const alpha = hasAlpha ? new Uint8Array(width * height) : undefined;
  for (let pixel = 0; pixel < width * height; pixel++) {
    for (let channel = 0; channel < colorComponents; channel++) raster[pixel * colorComponents + channel] = pixels[pixel * components + channel];
    if (alpha) alpha[pixel] = pixels[pixel * components + colorComponents];
  }
  return {
    source: "raster", width, height,
    colorSpace: colorComponents === 1 ? "DeviceGray" : "DeviceRGB",
    bytes: new Uint8Array(deflateSync(raster)),
    ...(alpha ? { alpha: new Uint8Array(deflateSync(alpha)) } : {}),
  };
}

function predictor(filter: number, left: number, above: number, upperLeft: number): number {
  if (filter === 0) return 0;
  if (filter === 1) return left;
  if (filter === 2) return above;
  if (filter === 3) return Math.floor((left + above) / 2);
  if (filter === 4) {
    const estimate = left + above - upperLeft;
    const leftDistance = Math.abs(estimate - left);
    const aboveDistance = Math.abs(estimate - above);
    const upperLeftDistance = Math.abs(estimate - upperLeft);
    return leftDistance <= aboveDistance && leftDistance <= upperLeftDistance ? left : aboveDistance <= upperLeftDistance ? above : upperLeft;
  }
  throw new Error(`Unsupported PNG row filter ${filter}.`);
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}

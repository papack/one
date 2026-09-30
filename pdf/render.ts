import type { JSXNode } from "../jsx/jsx";
import { fontWeightValue, resolveFont } from "./layout";
import type { TtfFont } from "./ttf";
import { subsetTtfFont } from "./ttf";
import { deflateSync } from "node:zlib";
import { sRgbIccProfile } from "./srgb-profile";
import type { PdfImage } from "./image";
import { isSvgDocument, type SvgDocument } from "./svg";

type FontObjects = {
  type0: number;
  cid: number;
  descriptor: number;
  file: number;
  toUnicode: number;
  cidMap: number;
  resource: string;
};
type PageNumbers = { pageNumber: number; totalPages: number };
type ImageObjects = { image: number; alpha?: number; resource: string };
type DocumentMetadata = Record<string, unknown>;
export type PdfRenderState = Awaited<ReturnType<typeof createRenderState>>;

/** Allocates stable PDF object IDs before pages are supplied in batches. */
export async function createRenderState(
  totalPages: number,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  fonts: ReadonlyMap<string, TtfFont> = new Map(),
  metadata: DocumentMetadata = {},
  images: readonly PdfImage[] = [],
): Promise<{
  writePages: (
    pages: readonly JSXNode[],
    firstPageIndex: number,
  ) => Promise<void>;
  finish: () => Promise<void>;
}> {
  const fontObjects = new Map<TtfFont, FontObjects>();
  let nextCustomObject = 5;
  let fontIndex = 3;
  for (const font of fonts.values()) {
    fontObjects.set(font, {
      type0: nextCustomObject,
      cid: nextCustomObject + 1,
      descriptor: nextCustomObject + 2,
      file: nextCustomObject + 3,
      toUnicode: nextCustomObject + 4,
      cidMap: nextCustomObject + 5,
      resource: `F${fontIndex++}`,
    });
    nextCustomObject += 6;
  }
  const imageObjects = new Map<PdfImage, ImageObjects>();
  let imageIndex = 1;
  for (const image of images) {
    const imageId = nextCustomObject++;
    const alphaId = image.alpha ? nextCustomObject++ : undefined;
    imageObjects.set(image, {
      image: imageId,
      ...(alphaId ? { alpha: alphaId } : {}),
      resource: `Im${imageIndex++}`,
    });
  }
  const infoObject = nextCustomObject;
  const metadataObject = nextCustomObject + 1;
  const iccObject = nextCustomObject + 2;
  const outputIntentObject = nextCustomObject + 3;
  const firstPageObject = nextCustomObject + 4;
  const pageObjectId = (index: number) => firstPageObject + index * 2;
  const objectCount = totalPages
    ? pageObjectId(totalPages - 1) + 1
    : firstPageObject - 1;
  const offsets = Array.from({ length: objectCount + 1 }, () => 0);
  let offset = 0;

  const writeObject = async (id: number, body: string | Uint8Array) => {
    offsets[id] = offset;
    const bodyBytes = typeof body === "string" ? encodeLatin1(body) : body;
    const bytes = concatBytes(
      encodeLatin1(`${id} 0 obj\n`),
      bodyBytes,
      encodeLatin1("\nendobj\n"),
    );
    await write(writer, bytes);
    offset += bytes.byteLength;
  };

  const header = encodeLatin1("%PDF-1.7\n%\xE2\xE3\xCF\xD3\n");
  await write(writer, header);
  offset = header.byteLength;
  await writeObject(
    1,
    `<< /Type /Catalog /Pages 2 0 R /Metadata ${metadataObject} 0 R ` +
      `/OutputIntents [${outputIntentObject} 0 R]${metadata.language ? ` /Lang ${pdfUnicodeString(String(metadata.language))}` : ""} >>`,
  );
  await writeObject(
    2,
    `<< /Type /Pages /Count ${totalPages} /Kids [${Array.from({ length: totalPages }, (_, index) => `${pageObjectId(index)} 0 R`).join(" ")}] >>`,
  );
  await writeObject(
    3,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );
  await writeObject(
    4,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  );
  for (const font of fonts.values())
    await writeTtfFont(font, fontObjects.get(font)!, writeObject);
  for (const image of images)
    await writeImage(image, imageObjects.get(image)!, writeObject);
  await writeObject(infoObject, documentInfo(metadata));
  await writeObject(
    metadataObject,
    await streamBody(
      encodeUtf8(pdfA2uMetadata(metadata)),
      "/Type /Metadata /Subtype /XML",
    ),
  );
  await writeObject(
    iccObject,
    await streamBody(sRgbIccProfile(), "/N 3 /Alternate /DeviceRGB"),
  );
  await writeObject(
    outputIntentObject,
    `<< /Type /OutputIntent /S /GTS_PDFA1 /OutputConditionIdentifier (sRGB IEC61966-2.1) ` +
      `/Info (sRGB IEC61966-2.1) /DestOutputProfile ${iccObject} 0 R >>`,
  );

  const resources = ["/F1 3 0 R", "/F2 4 0 R"];
  for (const ids of fontObjects.values())
    resources.push(`/${ids.resource} ${ids.type0} 0 R`);
  const imageResources = images.map(
    (image) =>
      `/${imageObjects.get(image)!.resource} ${imageObjects.get(image)!.image} 0 R`,
  );
  return {
    async writePages(pages, firstPageIndex) {
      for (let index = 0; index < pages.length; index++) {
        const page = pages[index];
        const globalIndex = firstPageIndex + index;
        const width = numeric(page.layout?.width, 595);
        const height = numeric(page.layout?.height, 842);
        const props = asRecord(page.props);
        const pageNumbers = {
          pageNumber: numeric(props.pageNumber, globalIndex + 1),
          totalPages: numeric(props.totalPages, totalPages),
        };
        const commands = encodeLatin1(
          renderPage(
            page,
            height,
            width,
            fonts,
            fontObjects,
            imageObjects,
            pageNumbers,
          ),
        );
        const pageId = pageObjectId(globalIndex);
        await writeObject(
          pageId,
          `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] ` +
            `/Resources << /Font << ${resources.join(" ")} >> /XObject << ${imageResources.join(" ")} >> >> /Contents ${pageId + 1} 0 R >>`,
        );
        await writeObject(pageId + 1, await streamBody(commands, ""));
      }
    },
    async finish() {
      const xrefOffset = offset;
      let xref = `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`;
      for (const objectOffset of offsets.slice(1))
        xref += `${String(objectOffset).padStart(10, "0")} 00000 n \n`;
      const fileId = createFileId();
      xref +=
        `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R /Info ${infoObject} 0 R /ID [<${fileId}><${fileId}>] >>\n` +
        `startxref\n${xrefOffset}\n%%EOF\n`;
      await write(writer, encodeLatin1(xref));
      await writer.close();
    },
  };
}

/** Writes laid out pages as a PDF stream, embedding supplied TrueType fonts. */
export async function render(
  pages: readonly JSXNode[],
  writer: WritableStreamDefaultWriter<Uint8Array>,
  fonts: ReadonlyMap<string, TtfFont> = new Map(),
  metadata: DocumentMetadata = {},
  images: readonly PdfImage[] = [],
): Promise<void> {
  const state = await createRenderState(
    pages.length,
    writer,
    fonts,
    metadata,
    images,
  );
  await state.writePages(pages, 0);
  await state.finish();
}

async function writeTtfFont(
  font: TtfFont,
  ids: FontObjects,
  writeObject: (id: number, body: string | Uint8Array) => Promise<void>,
): Promise<void> {
  const faceName = pdfName(
    `${font.family}${font.weight === 400 ? "" : `-${font.weight}`}`,
  );
  const baseFont = `${subsetPrefix(font)}+${faceName}`;
  const subset = subsetTtfFont(font);
  const widths = font
    .codePoints()
    .map((_, index) =>
      Math.round((font.widthForCid(index + 1) * 1000) / font.unitsPerEm),
    );
  const widthArray = widths.length ? `/W [1 [${widths.join(" ")}]]` : "";
  const cidMap = new Uint8Array((font.codePoints().length + 1) * 2);
  for (let cid = 1; cid <= font.codePoints().length; cid++) {
    const glyph = subset.glyphForCid(cid);
    cidMap[cid * 2] = glyph >> 8;
    cidMap[cid * 2 + 1] = glyph & 0xff;
  }
  await writeObject(
    ids.type0,
    `<< /Type /Font /Subtype /Type0 /BaseFont /${baseFont} /Encoding /Identity-H /DescendantFonts [${ids.cid} 0 R] /ToUnicode ${ids.toUnicode} 0 R >>`,
  );
  await writeObject(
    ids.cid,
    `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${baseFont} ` +
      `/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> ` +
      `/FontDescriptor ${ids.descriptor} 0 R /DW 1000 ${widthArray} /CIDToGIDMap ${ids.cidMap} 0 R >>`,
  );
  await writeObject(
    ids.descriptor,
    `<< /Type /FontDescriptor /FontName /${baseFont} /Flags 32 /FontBBox [${font.bbox.join(" ")}] ` +
      `/ItalicAngle 0 /Ascent ${font.ascent} /Descent ${font.descent} /CapHeight ${font.capHeight} /StemV 80 /FontFile2 ${ids.file} 0 R >>`,
  );
  await writeObject(
    ids.file,
    await streamBody(subset.bytes, `/Length1 ${subset.bytes.byteLength}`),
  );
  await writeObject(
    ids.toUnicode,
    await streamBody(encodeLatin1(toUnicodeCMap(font)), ""),
  );
  await writeObject(ids.cidMap, await streamBody(cidMap, ""));
}

async function writeImage(
  image: PdfImage,
  ids: ImageObjects,
  writeObject: (id: number, body: string | Uint8Array) => Promise<void>,
): Promise<void> {
  const filter = image.source === "jpeg" ? "/DCTDecode" : "/FlateDecode";
  const alpha = ids.alpha ? ` /SMask ${ids.alpha} 0 R` : "";
  await writeObject(
    ids.image,
    await streamBody(
      image.bytes,
      `/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} ` +
        `/ColorSpace /${image.colorSpace} /BitsPerComponent 8 /Filter ${filter}${alpha}`,
      false,
    ),
  );
  if (ids.alpha && image.alpha) {
    await writeObject(
      ids.alpha,
      await streamBody(
        image.alpha,
        `/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} ` +
          `/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`,
        false,
      ),
    );
  }
}

function toUnicodeCMap(font: TtfFont): string {
  const entries = font
    .codePoints()
    .map((codePoint, index) => `<${hex4(index + 1)}> <${utf16Hex(codePoint)}>`);
  const groups: string[] = [];
  for (let index = 0; index < entries.length; index += 100) {
    const chunk = entries.slice(index, index + 100);
    groups.push(`${chunk.length} beginbfchar\n${chunk.join("\n")}\nendbfchar`);
  }
  return (
    `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n` +
    `/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n` +
    `/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n` +
    `<0000> <FFFF>\nendcodespacerange\n${groups.join("\n")}\nendcmap\n` +
    `CMapName currentdict /CMap defineresource pop\nend\nend`
  );
}

async function streamBody(
  bytes: Uint8Array,
  extraDictionary: string,
  compress = true,
): Promise<Uint8Array> {
  const encoded = compress ? new Uint8Array(deflateSync(bytes)) : bytes;
  const extra = `${compress ? "/Filter /FlateDecode " : ""}${extraDictionary ? `${extraDictionary} ` : ""}`;
  return concatBytes(
    encodeLatin1(`<< /Length ${encoded.byteLength} ${extra}>>\nstream\n`),
    encoded,
    encodeLatin1("\nendstream"),
  );
}

function renderPage(
  page: JSXNode,
  pageHeight: number,
  pageWidth: number,
  fonts: ReadonlyMap<string, TtfFont>,
  fontObjects: ReadonlyMap<TtfFont, FontObjects>,
  imageObjects: ReadonlyMap<PdfImage, ImageObjects>,
  pageNumbers: PageNumbers,
): string {
  const commands = [`1 1 1 rg 0 0 ${pageWidth} ${pageHeight} re f`];
  drawNode(
    page,
    pageHeight,
    commands,
    fonts,
    fontObjects,
    imageObjects,
    pageNumbers,
  );
  return commands.join("\n");
}

function drawNode(
  node: JSXNode,
  pageHeight: number,
  commands: string[],
  fonts: ReadonlyMap<string, TtfFont>,
  fontObjects: ReadonlyMap<TtfFont, FontObjects>,
  imageObjects: ReadonlyMap<PdfImage, ImageObjects>,
  pageNumbers: PageNumbers,
): void {
  const box = node.layout;
  if (box) {
    const style = asRecord(node.props.style);
    const background = color(style.backgroundColor);
    if (
      (node.type === "div" ||
        node.type === "p" ||
        node.type === "page" ||
        node.type === "table-cell") &&
      background &&
      !isWhite(style.backgroundColor)
    ) {
      commands.push(
        `q ${background} rg ${box.xPos} ${pageHeight - box.yPos - box.height} ${box.width} ${box.height} re f Q`,
      );
    }
    if (
      node.type === "div" ||
      node.type === "p" ||
      node.type === "page" ||
      node.type === "table-cell"
    ) {
      drawBorders(
        box.xPos,
        pageHeight - box.yPos - box.height,
        box.width,
        box.height,
        style,
        commands,
      );
    }
    if (node.type === "#text") {
      const value = String(node.props.value ?? "");
      const dynamicValue =
        node.props.dynamicText === "pageNumber"
          ? String(pageNumbers.pageNumber)
          : node.props.dynamicText === "pagesTotal"
            ? String(pageNumbers.totalPages)
            : undefined;
      const lines =
        dynamicValue !== undefined
          ? [dynamicValue]
          : box.textLines?.length
            ? box.textLines
            : [value];
      const textStyle = asRecord(node.props.style);
      const size = numeric(textStyle.fontSize, 12);
      const letterSpacing = numeric(textStyle.letterSpacing, 0);
      const lineHeight = numeric(box.lineHeight, size * 1.2);
      const fill = color(textStyle.color) ?? "0 0 0";
      const font = resolveFont(
        textStyle.fontFamily,
        fonts,
        textStyle.fontWeight,
      );
      if (!font)
        throw new Error(
          "PDF/A-2u requires every rendered text font to be embedded; provide a matching TTF font.",
        );
      const textX = box.xPos;
      if (font) {
        const ids = fontObjects.get(font)!;
        if (
          textStyle.writingMode === "vertical-rl" ||
          textStyle.writingMode === "vertical-lr"
        ) {
          const verticalX =
            textStyle.writingMode === "vertical-rl"
              ? box.xPos + box.width - size
              : box.xPos;
          const glyphs = Array.from(lines.join(""));
          glyphs.forEach((character, index) => {
            const baseline =
              pageHeight -
              box.yPos -
              index * lineHeight -
              (font.ascent * size) / font.unitsPerEm;
            const verticalBaseline = baseline - index * letterSpacing;
            commands.push(
              `BT /${ids.resource} ${size} Tf ${fill} rg 0 -1 1 0 ${verticalX} ${verticalBaseline} Tm <${encodeGlyphs(character, font)}> Tj ET`,
            );
          });
        } else {
          const targetWeight = fontWeightValue(textStyle.fontWeight);
          const italic =
            textStyle.fontStyle === "italic" ||
            textStyle.fontStyle === "oblique";
          const textMatrix = italic ? "1 0 0.2 1" : "1 0 0 1";
          const syntheticBold =
            targetWeight >= 600 && font.weight < targetWeight
              ? `2 Tr ${fill} RG 0.25 w `
              : "";
          lines.forEach((line, index) => {
            const baseline =
              pageHeight -
              box.yPos -
              index * lineHeight -
              (font.ascent * size) / font.unitsPerEm;
            commands.push(
              `BT /${ids.resource} ${size} Tf ${fill} rg ${syntheticBold}${letterSpacing} Tc ${textMatrix} ${textX} ${baseline} Tm <${encodeGlyphs(line, font)}> Tj 0 Tr ET`,
            );
          });
        }
      } else {
        const weight = textStyle.fontWeight;
        const fontName =
          weight === "bold" || (typeof weight === "number" && weight >= 600)
            ? "/F2"
            : "/F1";
        lines.forEach((line, index) => {
          const baseline = pageHeight - box.yPos - index * lineHeight - size;
          commands.push(
            `BT ${fontName} ${size} Tf ${fill} rg 1 0 0 1 ${textX} ${baseline} Tm (${pdfString(line)}) Tj ET`,
          );
        });
      }
    }
    if (node.type === "img") {
      const bottom = pageHeight - box.yPos - box.height;
      const imageValue = node.props.image;
      if (isSvgDocument(imageValue)) {
        drawSvg(
          imageValue,
          box.xPos,
          bottom,
          box.width,
          box.height,
          fonts,
          fontObjects,
          commands,
        );
      } else {
        const image = asImage(imageValue);
        const ids = imageObjects.get(image);
        if (!ids)
          throw new Error(
            "Image data was not registered before PDF rendering.",
          );
        commands.push(
          `q ${box.width} 0 0 ${box.height} ${box.xPos} ${bottom} cm /${ids.resource} Do Q`,
        );
      }
      drawBorders(box.xPos, bottom, box.width, box.height, style, commands);
    }
    if (node.type === "svg") {
      const document: SvgDocument = {
        type: "svg-document",
        width: box.width,
        height: box.height,
        viewBox: String(node.props.viewBox ?? `0 0 ${box.width} ${box.height}`),
        children: Array.isArray(node.props.svgChildren)
          ? node.props.svgChildren
          : [],
      };
      drawSvg(
        document,
        box.xPos,
        pageHeight - box.yPos - box.height,
        box.width,
        box.height,
        fonts,
        fontObjects,
        commands,
      );
    }
  }
  const children = Array.isArray(node.children)
    ? node.children
    : [node.children];
  for (const child of children)
    if (isJSXNode(child))
      drawNode(
        child,
        pageHeight,
        commands,
        fonts,
        fontObjects,
        imageObjects,
        pageNumbers,
      );
}

function drawSvg(
  svg: SvgDocument,
  x: number,
  bottom: number,
  width: number,
  height: number,
  fonts: ReadonlyMap<string, TtfFont>,
  fontObjects: ReadonlyMap<TtfFont, FontObjects>,
  commands: string[],
): void {
  const vb = (
    svg.viewBox ?? `0 0 ${svg.width ?? width} ${svg.height ?? height}`
  )
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (
    vb.length !== 4 ||
    vb.some((part) => !Number.isFinite(part)) ||
    vb[2] <= 0 ||
    vb[3] <= 0
  )
    return;
  const [minX, minY, vbWidth, vbHeight] = vb;
  const scale = Math.min(width / vbWidth, height / vbHeight);
  const drawnWidth = vbWidth * scale;
  const drawnHeight = vbHeight * scale;
  const originX = x + (width - drawnWidth) / 2 - minX * scale;
  const originY =
    bottom + (height - drawnHeight) / 2 + (minY + vbHeight) * scale;
  commands.push(
    `q ${x} ${bottom} ${width} ${height} re W n ${scale} 0 0 ${-scale} ${originX} ${originY} cm`,
  );
  for (const child of svg.children)
    drawSvgNode(child, {}, fonts, fontObjects, commands);
  commands.push("Q");
}

function drawSvgNode(
  value: unknown,
  inherited: Record<string, unknown>,
  fonts: ReadonlyMap<string, TtfFont>,
  fontObjects: ReadonlyMap<TtfFont, FontObjects>,
  commands: string[],
): void {
  if (typeof value === "string" || typeof value === "number") return;
  if (Array.isArray(value)) {
    for (const child of value)
      drawSvgNode(child, inherited, fonts, fontObjects, commands);
    return;
  }
  if (!isJSXNode(value)) return;
  const styleProps = camelSvgStyle(asRecord(value.props.style));
  const props = { ...inherited, ...value.props, ...styleProps };
  if (typeof value.type !== "string") return;
  const tag = value.type.toLowerCase();
  if (
    [
      "defs",
      "clippath",
      "lineargradient",
      "radialgradient",
      "stop",
      "title",
      "desc",
      "metadata",
    ].includes(tag)
  )
    return;
  if (tag === "g" || tag === "svg" || tag === "a") {
    commands.push("q");
    applySvgTransform(value.props.transform, commands);
    if (props.fill !== undefined)
      commands.push(`${pdfColor(String(props.fill))} rg`);
    if (props.stroke !== undefined && props.stroke !== "none")
      commands.push(`${pdfColor(String(props.stroke))} RG`);
    for (const child of Array.isArray(value.children)
      ? value.children
      : [value.children])
      drawSvgNode(child, props, fonts, fontObjects, commands);
    commands.push("Q");
    return;
  }
  if (tag === "text" || tag === "tspan") {
    const text = collectSvgText(value);
    const fontSize = svgNumber(props.fontSize, 12);
    const fill = svgPaint(props.fill, "black");
    const font = resolveFont(
      props.fontFamily ?? inherited.fontFamily,
      fonts,
      props.fontWeight ?? inherited.fontWeight,
    );
    if (text && font && fill !== "none") {
      const ids = fontObjects.get(font)!;
      const x = svgNumber(props.x, 0);
      const y = svgNumber(props.y, 0);
      const color = pdfColor(fill);
      const targetWeight = fontWeightValue(
        props.fontWeight ?? inherited.fontWeight,
      );
      const syntheticBold =
        targetWeight >= 600 && font.weight < targetWeight
          ? `2 Tr ${color} RG 0.25 w `
          : "";
      commands.push(
        `BT /${ids.resource} ${fontSize} Tf ${color} rg ${syntheticBold}1 0 0 1 ${x} ${y} Tm <${encodeGlyphs(text, font)}> Tj 0 Tr ET`,
      );
    } else if (text && fill !== "none") {
      const x = svgNumber(props.x, 0);
      const y = svgNumber(props.y, 0);
      const textStyle = {
        fontSize,
        fontFamily: props.fontFamily ?? inherited.fontFamily,
        fontWeight: props.fontWeight ?? inherited.fontWeight,
        color: fill,
      };
      const fallback = resolveFont(
        textStyle.fontFamily,
        fonts,
        textStyle.fontWeight,
      );
      if (fallback) {
        const ids = fontObjects.get(fallback)!;
        const color = pdfColor(fill);
        const targetWeight = fontWeightValue(textStyle.fontWeight);
        const syntheticBold =
          targetWeight >= 600 && fallback.weight < targetWeight
            ? `2 Tr ${color} RG 0.25 w `
            : "";
        commands.push(
          `BT /${ids.resource} ${fontSize} Tf ${color} rg ${syntheticBold}1 0 0 1 ${x} ${y} Tm <${encodeGlyphs(text, fallback)}> Tj 0 Tr ET`,
        );
      }
    }
    return;
  }
  const path = svgShapePath(tag, props);
  if (path) {
    commands.push("q");
    applySvgTransform(value.props.transform, commands);
    commands.push(path);
    paintSvg(props, commands);
    commands.push("Q");
  }
}

function collectSvgText(node: JSXNode): string {
  const children = Array.isArray(node.children)
    ? node.children
    : [node.children];
  return children
    .map((child) =>
      typeof child === "string" || typeof child === "number"
        ? String(child)
        : isJSXNode(child)
          ? collectSvgText(child)
          : "",
    )
    .join("");
}

function camelSvgStyle(
  style: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(style)) {
    result[key.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase())] =
      value;
  }
  return result;
}

function svgShapePath(
  tag: string,
  p: Record<string, unknown>,
): string | undefined {
  const n = (key: string, fallback = 0) => svgNumber(p[key], fallback);
  if (tag === "path") return pathData(String(p.d ?? ""));
  if (tag === "rect") {
    const x = n("x"),
      y = n("y"),
      w = n("width"),
      h = n("height");
    if (w <= 0 || h <= 0) return undefined;
    const rx = Math.min(n("rx", n("ry")), w / 2),
      ry = Math.min(n("ry", rx), h / 2);
    if (!rx && !ry)
      return `${x} ${y} m ${x + w} ${y} l ${x + w} ${y + h} l ${x} ${y + h} l h`;
    const k = 0.5522847498;
    return `${x + rx} ${y} m ${x + w - rx} ${y} ${x + w - rx + k * rx} ${y} ${x + w} ${y + ry - k * ry} ${x + w} ${y + ry} c ${x + w} ${y + h - ry} l ${x + w} ${y + h - ry + k * ry} ${x + w - rx + k * rx} ${y + h} ${x + w - rx} ${y + h} c ${x + rx} ${y + h} l ${x + rx - k * rx} ${y + h} ${x} ${y + h - ry + k * ry} ${x} ${y + h - ry} c ${x} ${y + ry} l ${x} ${y + ry - k * ry} ${x + rx - k * rx} ${y} ${x + rx} ${y} c h`;
  }
  if (tag === "circle" || tag === "ellipse") {
    const cx = n("cx"),
      cy = n("cy"),
      rx = tag === "circle" ? n("r") : n("rx"),
      ry = tag === "circle" ? rx : n("ry");
    if (rx <= 0 || ry <= 0) return undefined;
    const k = 0.5522847498;
    return `${cx + rx} ${cy} m ${cx + rx} ${cy + k * ry} ${cx + k * rx} ${cy + ry} ${cx} ${cy + ry} c ${cx - k * rx} ${cy + ry} ${cx - rx} ${cy + k * ry} ${cx - rx} ${cy} c ${cx - rx} ${cy - k * ry} ${cx - k * rx} ${cy - ry} ${cx} ${cy - ry} c ${cx + k * rx} ${cy - ry} ${cx + rx} ${cy - k * ry} ${cx + rx} ${cy} c h`;
  }
  if (tag === "line") return `${n("x1")} ${n("y1")} m ${n("x2")} ${n("y2")} l`;
  if (tag === "polyline" || tag === "polygon") {
    const points = String(p.points ?? "")
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (
      points.length < 4 ||
      points.length % 2 ||
      points.some((point) => !Number.isFinite(point))
    )
      return undefined;
    let path = `${points[0]} ${points[1]} m`;
    for (let i = 2; i < points.length; i += 2)
      path += ` ${points[i]} ${points[i + 1]} l`;
    return `${path}${tag === "polygon" ? " h" : ""}`;
  }
  return undefined;
}

function pathData(d: string): string | undefined {
  const tokens =
    d.match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?|[a-zA-Z]/g) ?? [];
  let i = 0,
    command = "",
    x = 0,
    y = 0,
    sx = 0,
    sy = 0,
    previous = "",
    cx = 0,
    cy = 0;
  const out: string[] = [];
  const has = () => i < tokens.length && !/^[a-z]$/i.test(tokens[i]);
  const take = () => Number(tokens[i++]);
  try {
    while (i < tokens.length) {
      if (/^[a-z]$/i.test(tokens[i])) command = tokens[i++];
      if (!command) return undefined;
      const relative = command === command.toLowerCase(),
        upper = command.toUpperCase();
      const px = () => {
        const v = take();
        return relative ? x + v : v;
      };
      const py = () => {
        const v = take();
        return relative ? y + v : v;
      };
      if (upper === "Z") {
        out.push("h");
        x = sx;
        y = sy;
        previous = "Z";
        command = "";
        continue;
      }
      if (!has()) return undefined;
      if (upper === "M" || upper === "L") {
        x = px();
        y = py();
        out.push(`${x} ${y} ${upper === "M" ? "m" : "l"}`);
        if (upper === "M") {
          sx = x;
          sy = y;
          command = relative ? "l" : "L";
        }
        previous = upper;
      } else if (upper === "H") {
        x = px();
        out.push(`${x} ${y} l`);
        previous = upper;
      } else if (upper === "V") {
        y = py();
        out.push(`${x} ${y} l`);
        previous = upper;
      } else if (upper === "C") {
        const x1 = px(),
          y1 = py(),
          x2 = px(),
          y2 = py();
        x = px();
        y = py();
        out.push(`${x1} ${y1} ${x2} ${y2} ${x} ${y} c`);
        cx = x2;
        cy = y2;
        previous = upper;
      } else if (upper === "S") {
        const x1 = previous === "C" || previous === "S" ? 2 * x - cx : x,
          y1 = previous === "C" || previous === "S" ? 2 * y - cy : y;
        const x2 = px(),
          y2 = py();
        x = px();
        y = py();
        out.push(`${x1} ${y1} ${x2} ${y2} ${x} ${y} c`);
        cx = x2;
        cy = y2;
        previous = upper;
      } else if (upper === "Q" || upper === "T") {
        let qx: number, qy: number;
        if (upper === "Q") {
          qx = px();
          qy = py();
        } else {
          qx = previous === "Q" || previous === "T" ? 2 * x - cx : x;
          qy = previous === "Q" || previous === "T" ? 2 * y - cy : y;
        }
        const nx = px(),
          ny = py();
        const c1x = x + (2 / 3) * (qx - x),
          c1y = y + (2 / 3) * (qy - y),
          c2x = nx + (2 / 3) * (qx - nx),
          c2y = ny + (2 / 3) * (qy - ny);
        out.push(`${c1x} ${c1y} ${c2x} ${c2y} ${nx} ${ny} c`);
        x = nx;
        y = ny;
        cx = qx;
        cy = qy;
        previous = upper;
      } else if (upper === "A") {
        const rx = Math.abs(take()),
          ry = Math.abs(take()),
          rot = (take() * Math.PI) / 180,
          large = take(),
          sweep = take(),
          nx = px(),
          ny = py();
        out.push(...arcToCubics(x, y, rx, ry, rot, large, sweep, nx, ny));
        x = nx;
        y = ny;
        previous = upper;
      } else return undefined;
    }
  } catch {
    return undefined;
  }
  return out
    .join(" ")
    .replace(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)/gi, (value) =>
      Number(value)
        .toFixed(8)
        .replace(/\.?0+$/, ""),
    );
}

function arcToCubics(
  x1: number,
  y1: number,
  rx0: number,
  ry0: number,
  phi: number,
  large: number,
  sweep: number,
  x2: number,
  y2: number,
): string[] {
  if (!rx0 || !ry0 || (x1 === x2 && y1 === y2)) return [`${x2} ${y2} l`];
  const cos = Math.cos(phi),
    sin = Math.sin(phi),
    dx = (x1 - x2) / 2,
    dy = (y1 - y2) / 2;
  const xp = cos * dx + sin * dy,
    yp = -sin * dx + cos * dy;
  let rx = rx0,
    ry = ry0;
  const lambda = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const sign = large === sweep ? -1 : 1,
    den = rx * rx * yp * yp + ry * ry * xp * xp;
  const coef = sign * Math.sqrt(Math.max(0, (rx * rx * ry * ry - den) / den));
  const cxp = coef * ((rx * yp) / ry),
    cyp = coef * ((-ry * xp) / rx),
    cx = cos * cxp - sin * cyp + (x1 + x2) / 2,
    cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) =>
    Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const ux = (xp - cxp) / rx,
    uy = (yp - cyp) / ry,
    vx = (-xp - cxp) / rx,
    vy = (-yp - cyp) / ry;
  let start = angle(1, 0, ux, uy),
    delta = angle(ux, uy, vx, vy);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  const segments = Math.ceil(Math.abs(delta) / (Math.PI / 2)),
    step = delta / segments,
    result: string[] = [];
  const point = (a: number) => [
    cx + rx * cos * Math.cos(a) - ry * sin * Math.sin(a),
    cy + rx * sin * Math.cos(a) + ry * cos * Math.sin(a),
  ];
  for (let s = 0; s < segments; s++) {
    const a = start + s * step,
      b = a + step,
      k = (4 / 3) * Math.tan((b - a) / 4),
      p1 = point(a),
      p2 = point(b),
      d1 = [
        -rx * cos * Math.sin(a) - ry * sin * Math.cos(a),
        -rx * sin * Math.sin(a) + ry * cos * Math.cos(a),
      ],
      d2 = [
        -rx * cos * Math.sin(b) - ry * sin * Math.cos(b),
        -rx * sin * Math.sin(b) + ry * cos * Math.cos(b),
      ];
    result.push(
      `${p1[0] + k * d1[0]} ${p1[1] + k * d1[1]} ${p2[0] - k * d2[0]} ${p2[1] - k * d2[1]} ${p2[0]} ${p2[1]} c`,
    );
  }
  return result;
}

function paintSvg(props: Record<string, unknown>, commands: string[]): void {
  const fill = svgPaint(props.fill, "black"),
    stroke = svgPaint(props.stroke, "none");
  const hasFill = fill !== "none",
    hasStroke = stroke !== "none";
  if (!hasFill && !hasStroke) return;
  if (hasFill) commands.push(`${pdfColor(fill)} rg`);
  if (hasStroke)
    commands.push(
      `${pdfColor(stroke)} RG ${svgNumber(props.strokeWidth, 1)} w`,
    );
  const cap =
    ({ butt: 0, round: 1, square: 2 } as Record<string, number>)[
      String(props.strokeLinecap)
    ] ?? 0;
  const join =
    ({ miter: 0, round: 1, bevel: 2 } as Record<string, number>)[
      String(props.strokeLinejoin)
    ] ?? 0;
  commands.push(`${cap} J ${join} j`);
  if (
    typeof props.strokeDasharray === "string" &&
    props.strokeDasharray !== "none"
  )
    commands.push(
      `[${props.strokeDasharray.replaceAll(",", " ")}] ${svgNumber(props.strokeDashoffset, 0)} d`,
    );
  commands.push(
    hasFill && hasStroke
      ? props.fillRule === "evenodd"
        ? "B*"
        : "B"
      : hasFill
        ? props.fillRule === "evenodd"
          ? "f*"
          : "f"
        : "S",
  );
}

function applySvgTransform(value: unknown, commands: string[]): void {
  if (typeof value !== "string") return;
  for (const match of value.matchAll(
    /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g,
  )) {
    const v = match[2]
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (v.some((n) => !Number.isFinite(n))) continue;
    if (match[1] === "matrix" && v.length === 6)
      commands.push(`${v.join(" ")} cm`);
    else if (match[1] === "translate")
      commands.push(`1 0 0 1 ${v[0] || 0} ${v[1] || 0} cm`);
    else if (match[1] === "scale")
      commands.push(`${v[0]} 0 0 ${v[1] ?? v[0]} 0 0 cm`);
    else if (match[1] === "rotate") {
      const a = (v[0] * Math.PI) / 180,
        c = Math.cos(a),
        s = Math.sin(a),
        cx = v[1] || 0,
        cy = v[2] || 0;
      commands.push(
        `1 0 0 1 ${cx} ${cy} cm ${c} ${s} ${-s} ${c} 0 0 cm 1 0 0 1 ${-cx} ${-cy} cm`,
      );
    } else if (match[1] === "skewX")
      commands.push(`1 0 ${Math.tan((v[0] * Math.PI) / 180)} 1 0 0 cm`);
    else if (match[1] === "skewY")
      commands.push(`1 ${Math.tan((v[0] * Math.PI) / 180)} 0 1 0 0 cm`);
  }
}

function svgNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const match = /^\s*(-?(?:\d+\.?\d*|\.\d+))(?:px|pt)?\s*$/.exec(value);
    if (match) return Number(match[1]);
  }
  return fallback;
}
function svgPaint(value: unknown, fallback: string): string {
  return value === undefined ? fallback : String(value);
}
function pdfColor(value: string): string {
  return color(value) ?? "0 0 0";
}

function asImage(value: unknown): PdfImage {
  if (typeof value !== "object" || value === null || !("source" in value))
    throw new Error("Image source was not resolved before rendering.");
  return value as PdfImage;
}

function drawBorders(
  x: number,
  bottom: number,
  width: number,
  height: number,
  style: Record<string, unknown>,
  commands: string[],
): void {
  const sides = [
    {
      edge: "Top",
      x1: x,
      y1: bottom + height,
      x2: x + width,
      y2: bottom + height,
    },
    {
      edge: "Right",
      x1: x + width,
      y1: bottom,
      x2: x + width,
      y2: bottom + height,
    },
    { edge: "Bottom", x1: x, y1: bottom, x2: x + width, y2: bottom },
    { edge: "Left", x1: x, y1: bottom, x2: x, y2: bottom + height },
  ];
  for (const side of sides) {
    const lineWidth = numeric(style[`border${side.edge}Width`], 0);
    const lineColor = color(style[`border${side.edge}Color`]);
    const lineStyle = style[`border${side.edge}Style`];
    if (
      lineWidth <= 0 ||
      !lineColor ||
      lineStyle === "none" ||
      lineStyle === "hidden"
    )
      continue;
    const dash =
      lineStyle === "dashed"
        ? `[${lineWidth * 3} ${lineWidth * 2}] 0 d`
        : lineStyle === "dotted"
          ? `[${lineWidth} ${lineWidth * 2}] 0 d`
          : "[] 0 d";
    commands.push(`q ${lineColor} RG ${lineWidth} w ${dash}`);
    if (lineStyle === "double") {
      const offset = lineWidth;
      const horizontal = side.edge === "Top" || side.edge === "Bottom";
      const sign = side.edge === "Bottom" || side.edge === "Left" ? 1 : -1;
      for (const delta of [-offset, offset]) {
        const shift = ((delta + offset) * sign) / 2;
        commands.push(
          `${horizontal ? side.x1 : side.x1 + shift} ${horizontal ? side.y1 + shift : side.y1} m ${horizontal ? side.x2 : side.x2 + shift} ${horizontal ? side.y2 + shift : side.y2} l S`,
        );
      }
    } else {
      commands.push(`${side.x1} ${side.y1} m ${side.x2} ${side.y2} l S`);
    }
    commands.push("Q");
  }
}

function pdfA2uMetadata(metadata: DocumentMetadata): string {
  const creationDate =
    metadata.creationDate instanceof Date
      ? metadata.creationDate.toISOString()
      : new Date().toISOString();
  const modificationDate =
    metadata.modificationDate instanceof Date
      ? metadata.modificationDate.toISOString()
      : creationDate;
  const title = xmlEscape(metadata.title);
  const author = xmlEscape(metadata.author);
  const subject = xmlEscape(metadata.subject);
  const keywords = keywordList(metadata.keywords);
  const creator = xmlEscape(metadata.creator ?? "PDF Renderer");
  const producer = xmlEscape(metadata.producer ?? "PDF Renderer");
  const language = xmlEscape(metadata.language);
  return (
    `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>` +
    `<x:xmpmeta xmlns:x="adobe:ns:meta/">` +
    `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">` +
    `<rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/" pdfaid:part="2" pdfaid:conformance="U" ` +
    `xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:pdf="http://ns.adobe.com/pdf/1.3/" ` +
    `xmp:CreatorTool="${creator}" xmp:CreateDate="${creationDate}" xmp:ModifyDate="${modificationDate}" xmp:MetadataDate="${modificationDate}" pdf:Producer="${producer}"` +
    `${keywords ? ` pdf:Keywords="${xmlEscape(keywords)}"` : ""}>` +
    `<dc:format>application/pdf</dc:format>` +
    `${title ? `<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${title}</rdf:li></rdf:Alt></dc:title>` : ""}` +
    `${author ? `<dc:creator><rdf:Seq><rdf:li>${author}</rdf:li></rdf:Seq></dc:creator>` : ""}` +
    `${subject ? `<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${subject}</rdf:li></rdf:Alt></dc:description>` : ""}` +
    `${
      keywords
        ? `<dc:subject><rdf:Bag>${keywords
            .split(",")
            .map((word) => `<rdf:li>${xmlEscape(word.trim())}</rdf:li>`)
            .join("")}</rdf:Bag></dc:subject>`
        : ""
    }` +
    `${language ? `<dc:language><rdf:Bag><rdf:li>${language}</rdf:li></rdf:Bag></dc:language>` : ""}` +
    `</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`
  );
}

function documentInfo(metadata: DocumentMetadata): string {
  const fields: Array<[string, unknown]> = [
    ["Title", metadata.title],
    ["Author", metadata.author],
    ["Subject", metadata.subject],
    ["Keywords", keywordList(metadata.keywords)],
    ["Creator", metadata.creator ?? "PDF Renderer"],
    ["Producer", metadata.producer ?? "PDF Renderer"],
    ["CreationDate", pdfDate(metadata.creationDate)],
    ["ModDate", pdfDate(metadata.modificationDate ?? metadata.creationDate)],
  ];
  return `<< ${fields
    .filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    )
    .map(
      ([key, value]) =>
        `/${key} ${key.endsWith("Date") ? pdfUnicodeString(String(value)) : pdfUnicodeString(String(value))}`,
    )
    .join(" ")} >>`;
}

function pdfDate(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.getTime()))
    throw new TypeError(
      "Document creationDate and modificationDate must be valid dates.",
    );
  const p = (number: number) => String(number).padStart(2, "0");
  return `D:${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}Z`;
}

function keywordList(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(String).join(", ");
  return "";
}

function xmlEscape(value: unknown): string {
  return value === undefined || value === null
    ? ""
    : String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");
}

function pdfUnicodeString(value: string): string {
  return `<FEFF${Array.from(value, (character) => utf16Hex(character.codePointAt(0)!)).join("")}>`;
}

function createFileId(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function encodeGlyphs(text: string, font: TtfFont): string {
  let result = "";
  for (const character of text)
    result += hex4(font.cid(character.codePointAt(0)!));
  return result;
}

function utf16Hex(codePoint: number): string {
  if (codePoint <= 0xffff) return hex4(codePoint);
  const value = codePoint - 0x10000;
  return hex4(0xd800 + (value >> 10)) + hex4(0xdc00 + (value & 0x3ff));
}

function hex4(value: number): string {
  return value.toString(16).padStart(4, "0").toUpperCase();
}
function pdfName(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "_") || "EmbeddedFont";
}

function subsetPrefix(font: TtfFont): string {
  let hash = 2166136261;
  for (const byte of font.bytes) hash = Math.imul(hash ^ byte, 16777619);
  for (const codePoint of font.codePoints())
    hash = Math.imul(hash ^ codePoint, 16777619);
  hash = Math.imul(hash ^ font.weight, 16777619) >>> 0;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let prefix = "";
  for (let index = 0; index < 6; index++) {
    prefix += alphabet[hash % alphabet.length];
    hash = Math.floor(hash / alphabet.length);
  }
  return prefix;
}

function pdfString(value: string): string {
  return value
    .replaceAll("€", "\x80")
    .replaceAll("‘", "\x91")
    .replaceAll("’", "\x92")
    .replaceAll("“", "\x93")
    .replaceAll("”", "\x94")
    .replaceAll("•", "\x95")
    .replaceAll("–", "\x96")
    .replaceAll("—", "\x97")
    .replace(/[^\x20-\xFF]/g, "?")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function color(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const named: Record<string, string> = { black: "0 0 0", white: "1 1 1" };
  if (named[value.toLowerCase()]) return named[value.toLowerCase()];
  const hex = value.match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1];
  if (!hex) return undefined;
  const expanded =
    hex.length === 3 ? [...hex].map((part) => part + part).join("") : hex;
  return [0, 2, 4]
    .map((index) =>
      (parseInt(expanded.slice(index, index + 2), 16) / 255).toFixed(4),
    )
    .join(" ");
}

function isWhite(value: unknown): boolean {
  return (
    typeof value === "string" &&
    ["white", "#fff", "#ffffff"].includes(value.toLowerCase())
  );
}

function numeric(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
async function write(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  bytes: Uint8Array,
): Promise<void> {
  await writer.write(bytes);
}
function encodeLatin1(value: string): Uint8Array {
  return Uint8Array.from(value, (character) => character.charCodeAt(0) & 0xff);
}
function encodeUtf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}
function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(
    parts.reduce((sum, part) => sum + part.byteLength, 0),
  );
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
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

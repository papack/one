export type TtfFont = {
  family: string;
  weight: number;
  bytes: Uint8Array;
  unitsPerEm: number;
  ascent: number;
  descent: number;
  capHeight: number;
  bbox: [number, number, number, number];
  glyphId(codePoint: number): number;
  width(codePoint: number): number;
  collect(codePoint: number): number;
  codePoints(): readonly number[];
  cid(codePoint: number): number;
  glyphForCid(cid: number): number;
  widthForCid(cid: number): number;
};

export type TtfSubset = {
  bytes: Uint8Array;
  glyphForCid(cid: number): number;
};

/** Reads TrueType cmap and hmtx tables for exact glyph advances and PDF embedding. */
export function parseTtfFont(
  family: string,
  source: ArrayBuffer | Uint8Array,
  weight = 400,
): TtfFont {
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tables = readTables(view);
  const head = table(tables, "head");
  const hhea = table(tables, "hhea");
  const maxp = table(tables, "maxp");
  const hmtx = table(tables, "hmtx");
  const cmap = table(tables, "cmap");
  const unitsPerEm = view.getUint16(head.offset + 18);
  const bbox: [number, number, number, number] = [
    view.getInt16(head.offset + 36),
    view.getInt16(head.offset + 38),
    view.getInt16(head.offset + 40),
    view.getInt16(head.offset + 42),
  ];
  const ascent = view.getInt16(hhea.offset + 4);
  const descent = view.getInt16(hhea.offset + 6);
  const numberOfMetrics = view.getUint16(hhea.offset + 34);
  const glyphCount = view.getUint16(maxp.offset + 4);
  const advances = new Uint16Array(glyphCount);
  let lastAdvance = 0;
  for (let glyph = 0; glyph < glyphCount; glyph++) {
    if (glyph < numberOfMetrics)
      lastAdvance = view.getUint16(hmtx.offset + glyph * 4);
    advances[glyph] = lastAdvance;
  }
  const glyphLookup = createCmapLookup(view, cmap);
  const collected = new Map<number, number>();
  const codePoints: number[] = [];
  const glyphs: number[] = [0];
  const widths: number[] = [0];

  return {
    family,
    weight,
    bytes,
    unitsPerEm,
    ascent,
    descent,
    capHeight: readCapHeight(view, tables, ascent),
    bbox,
    glyphId: glyphLookup,
    width(codePoint) {
      return advances[glyphLookup(codePoint)] ?? advances[0] ?? unitsPerEm;
    },
    collect(codePoint) {
      const existing = collected.get(codePoint);
      if (existing !== undefined) return existing;
      const cid = codePoints.length + 1;
      if (cid > 0xffff)
        throw new Error(
          `Font ${family} uses more than 65,535 unique characters`,
        );
      collected.set(codePoint, cid);
      codePoints.push(codePoint);
      const glyph = glyphLookup(codePoint);
      glyphs[cid] = glyph;
      widths[cid] = advances[glyph] ?? advances[0] ?? unitsPerEm;
      return cid;
    },
    codePoints: () => codePoints,
    cid(codePoint) {
      return collected.get(codePoint) ?? 0;
    },
    glyphForCid(cid) {
      return glyphs[cid] ?? 0;
    },
    widthForCid(cid) {
      return widths[cid] ?? 0;
    },
  };
}

/** Builds a compact PDF font program containing only collected glyphs. */
export function subsetTtfFont(font: TtfFont): TtfSubset {
  const source = font.bytes;
  const sourceView = new DataView(
    source.buffer,
    source.byteOffset,
    source.byteLength,
  );
  const tables = readTables(sourceView);
  const required = (tag: string) => {
    const found = tables.get(tag);
    if (!found) throw new Error(`TTF font is missing the ${tag} table`);
    return found;
  };
  const headTable = required("head");
  const hheaTable = required("hhea");
  const maxpTable = required("maxp");
  const hmtxTable = required("hmtx");
  const locaTable = required("loca");
  const glyfTable = required("glyf");
  const locaFormat = sourceView.getInt16(headTable.offset + 50);
  const metricCount = sourceView.getUint16(hheaTable.offset + 34);
  const glyphOffset = (glyph: number) =>
    locaFormat === 0
      ? sourceView.getUint16(locaTable.offset + glyph * 2) * 2
      : sourceView.getUint32(locaTable.offset + glyph * 4);
  const mapping = new Map<number, number>([[0, 0]]);
  const originals = [0];
  const include = (glyph: number) => {
    const existing = mapping.get(glyph);
    if (existing !== undefined) return existing;
    const subsetGlyph = originals.length;
    mapping.set(glyph, subsetGlyph);
    originals.push(glyph);
    return subsetGlyph;
  };
  const cidMappings = [0];
  for (const codePoint of font.codePoints())
    cidMappings.push(include(font.glyphId(codePoint)));

  const glyfParts: Uint8Array[] = [];
  const offsets: number[] = [];
  let glyfLength = 0;
  for (let subsetGlyph = 0; subsetGlyph < originals.length; subsetGlyph++) {
    const originalGlyph = originals[subsetGlyph];
    offsets.push(glyfLength);
    const start = glyphOffset(originalGlyph);
    const end = glyphOffset(originalGlyph + 1);
    let glyphBytes: Uint8Array = source.slice(
      glyfTable.offset + start,
      glyfTable.offset + end,
    );
    if (
      glyphBytes.length >= 10 &&
      sourceView.getInt16(glyfTable.offset + start) < 0
    )
      glyphBytes = remapCompositeGlyph(glyphBytes, include);
    if (glyphBytes.length & 1) {
      const padded = new Uint8Array(glyphBytes.length + 1);
      padded.set(glyphBytes);
      glyphBytes = padded;
    }
    glyfParts.push(glyphBytes);
    glyfLength += glyphBytes.length;
  }
  offsets.push(glyfLength);

  const glyf = joinBytes(glyfParts, glyfLength);
  const loca = new Uint8Array(offsets.length * 4);
  const locaView = new DataView(loca.buffer);
  for (let index = 0; index < offsets.length; index++)
    locaView.setUint32(index * 4, offsets[index]);

  const hmtx = new Uint8Array(originals.length * 4);
  const hmtxView = new DataView(hmtx.buffer);
  const lastAdvance = sourceView.getUint16(
    hmtxTable.offset + (metricCount - 1) * 4,
  );
  for (let index = 0; index < originals.length; index++) {
    const glyph = originals[index];
    const advance =
      glyph < metricCount
        ? sourceView.getUint16(hmtxTable.offset + glyph * 4)
        : lastAdvance;
    const bearing =
      glyph < metricCount
        ? sourceView.getInt16(hmtxTable.offset + glyph * 4 + 2)
        : sourceView.getInt16(
            hmtxTable.offset + metricCount * 4 + (glyph - metricCount) * 2,
          );
    hmtxView.setUint16(index * 4, advance);
    hmtxView.setInt16(index * 4 + 2, bearing);
  }

  const head = source.slice(
    headTable.offset,
    headTable.offset + headTable.length,
  );
  const hhea = source.slice(
    hheaTable.offset,
    hheaTable.offset + hheaTable.length,
  );
  const maxp = source.slice(
    maxpTable.offset,
    maxpTable.offset + maxpTable.length,
  );
  const headView = new DataView(head.buffer, head.byteOffset, head.byteLength);
  const hheaView = new DataView(hhea.buffer, hhea.byteOffset, hhea.byteLength);
  const maxpView = new DataView(maxp.buffer, maxp.byteOffset, maxp.byteLength);
  headView.setUint32(8, 0);
  headView.setInt16(50, 1);
  hheaView.setUint16(34, originals.length);
  maxpView.setUint16(4, originals.length);

  const subsetTables = new Map<string, Uint8Array>([
    ["glyf", glyf],
    ["head", head],
    ["hhea", hhea],
    ["hmtx", hmtx],
    ["loca", loca],
    ["maxp", maxp],
  ]);
  for (const tag of ["cvt ", "fpgm", "prep"]) {
    const table = tables.get(tag);
    if (table)
      subsetTables.set(
        tag,
        source.slice(table.offset, table.offset + table.length),
      );
  }
  return {
    bytes: encodeSfnt(subsetTables),
    glyphForCid(cid) {
      return cidMappings[cid] ?? 0;
    },
  };
}

function remapCompositeGlyph(
  glyph: Uint8Array,
  include: (glyph: number) => number,
): Uint8Array {
  const output = glyph.slice();
  const view = new DataView(
    output.buffer,
    output.byteOffset,
    output.byteLength,
  );
  let position = 10;
  let flags: number;
  do {
    flags = view.getUint16(position);
    const originalGlyph = view.getUint16(position + 2);
    view.setUint16(position + 2, include(originalGlyph));
    position += 4;
    position += flags & 0x0001 ? 4 : 2;
    if (flags & 0x0008) position += 2;
    else if (flags & 0x0040) position += 4;
    else if (flags & 0x0080) position += 8;
  } while (flags & 0x0020);
  return output;
}

function encodeSfnt(tables: Map<string, Uint8Array>): Uint8Array {
  const ordered = [...tables].sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const count = ordered.length;
  const power = 2 ** Math.floor(Math.log2(count));
  const directoryLength = 12 + count * 16;
  let offset = directoryLength;
  const records = ordered.map(([tag, bytes]) => {
    const record = { tag, bytes, offset, checksum: checksum(bytes) };
    offset += (bytes.length + 3) & ~3;
    return record;
  });
  const output = new Uint8Array(offset);
  const view = new DataView(output.buffer);
  view.setUint32(0, 0x00010000);
  view.setUint16(4, count);
  view.setUint16(6, power * 16);
  view.setUint16(8, Math.log2(power));
  view.setUint16(10, count * 16 - power * 16);
  records.forEach((record, index) => {
    const position = 12 + index * 16;
    for (let character = 0; character < 4; character++)
      output[position + character] = record.tag.charCodeAt(character);
    view.setUint32(position + 4, record.checksum);
    view.setUint32(position + 8, record.offset);
    view.setUint32(position + 12, record.bytes.length);
    output.set(record.bytes, record.offset);
  });
  const head = records.find((record) => record.tag === "head");
  if (!head) throw new Error("Subset font is missing the head table.");
  view.setUint32(head.offset + 8, (0xb1b0afba - checksum(output)) >>> 0);
  return output;
}

function checksum(bytes: Uint8Array): number {
  let sum = 0;
  for (let offset = 0; offset < bytes.length; offset += 4) {
    const word =
      ((bytes[offset] ?? 0) << 24) |
      ((bytes[offset + 1] ?? 0) << 16) |
      ((bytes[offset + 2] ?? 0) << 8) |
      (bytes[offset + 3] ?? 0);
    sum = (sum + (word >>> 0)) >>> 0;
  }
  return sum;
}

function joinBytes(parts: Uint8Array[], length: number): Uint8Array {
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

type Table = { offset: number; length: number };

function readTables(view: DataView): Map<string, Table> {
  const count = view.getUint16(4);
  const tables = new Map<string, Table>();
  for (let index = 0; index < count; index++) {
    const record = 12 + index * 16;
    const tag = String.fromCharCode(
      view.getUint8(record),
      view.getUint8(record + 1),
      view.getUint8(record + 2),
      view.getUint8(record + 3),
    );
    tables.set(tag, {
      offset: view.getUint32(record + 8),
      length: view.getUint32(record + 12),
    });
  }
  return tables;
}

function table(tables: Map<string, Table>, tag: string): Table {
  const found = tables.get(tag);
  if (!found) throw new Error(`TTF font is missing the ${tag} table`);
  return found;
}

function createCmapLookup(
  view: DataView,
  cmap: Table,
): (codePoint: number) => number {
  const count = view.getUint16(cmap.offset + 2);
  let best: { offset: number; format: number } | undefined;
  for (let index = 0; index < count; index++) {
    const record = cmap.offset + 4 + index * 8;
    const platform = view.getUint16(record);
    const encoding = view.getUint16(record + 2);
    const subtableOffset = cmap.offset + view.getUint32(record + 4);
    const format = view.getUint16(subtableOffset);
    const supported =
      format === 12 || (format === 4 && codePointInBmp(platform, encoding));
    if (
      supported &&
      (!best ||
        format > best.format ||
        (format === best.format && platform === 3))
    )
      best = { offset: subtableOffset, format };
  }
  if (!best)
    throw new Error("TTF font has no supported Unicode cmap (format 4 or 12)");
  return best.format === 12
    ? (codePoint) => glyphForFormat12(view, best!.offset, codePoint)
    : (codePoint) => glyphForFormat4(view, best!.offset, codePoint);
}

function codePointInBmp(platform: number, encoding: number): boolean {
  return (
    platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10))
  );
}

function glyphForFormat12(
  view: DataView,
  offset: number,
  codePoint: number,
): number {
  const groups = view.getUint32(offset + 12);
  let low = 0;
  let high = groups - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const group = offset + 16 + middle * 12;
    const start = view.getUint32(group);
    const end = view.getUint32(group + 4);
    if (codePoint < start) high = middle - 1;
    else if (codePoint > end) low = middle + 1;
    else return view.getUint32(group + 8) + codePoint - start;
  }
  return 0;
}

function glyphForFormat4(
  view: DataView,
  offset: number,
  codePoint: number,
): number {
  if (codePoint > 0xffff) return 0;
  const segmentCount = view.getUint16(offset + 6) / 2;
  const endCodes = offset + 14;
  const startCodes = endCodes + segmentCount * 2 + 2;
  const deltas = startCodes + segmentCount * 2;
  const rangeOffsets = deltas + segmentCount * 2;
  for (let index = 0; index < segmentCount; index++) {
    const end = view.getUint16(endCodes + index * 2);
    if (codePoint > end) continue;
    const start = view.getUint16(startCodes + index * 2);
    if (codePoint < start) return 0;
    const delta = view.getInt16(deltas + index * 2);
    const rangeOffsetAddress = rangeOffsets + index * 2;
    const rangeOffset = view.getUint16(rangeOffsetAddress);
    if (rangeOffset === 0) return (codePoint + delta) & 0xffff;
    const glyphAddress =
      rangeOffsetAddress + rangeOffset + (codePoint - start) * 2;
    const glyph = view.getUint16(glyphAddress);
    return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
  }
  return 0;
}

function readCapHeight(
  view: DataView,
  tables: Map<string, Table>,
  fallback: number,
): number {
  const os2 = tables.get("OS/2");
  return os2 && os2.length >= 90 && view.getInt16(os2.offset) >= 2
    ? view.getInt16(os2.offset + 88)
    : fallback;
}

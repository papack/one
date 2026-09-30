# PDF Renderer

A small, standalone PDF renderer for TypeScript and TSX. It resolves custom synchronous and asynchronous JSX components, measures text using embedded TrueType fonts, calculates layout, and returns the finished PDF as a web `ReadableStream`.

```tsx
import { readFile } from "node:fs/promises";
import { jsx } from "./jsx";
import { pdf, pdfStreamToDisk } from "./pdf";

const roboto = new Uint8Array(await readFile("fonts/Roboto.ttf"));

const stream = pdf(
  <document title="Quarterly report" author="Northwind Studio" style={{ fontFamily: "Roboto" }}>
    <page size="A4" style={{ padding: 40 }}>
      <p style={{ fontSize: 24, fontWeight: "bold" }}>Quarterly report</p>
      <p>Generated with measured text and a custom layout.</p>
    </page>
  </document>,
  { fonts: { Roboto: { 400: roboto } } },
);

await pdfStreamToDisk(stream, "report.pdf");
```

## Contents

- [Requirements and getting started](#requirements-and-getting-started)
- [Public API](#public-api)
- [Documents and pages](#documents-and-pages)
- [Layout and positioning](#layout-and-positioning)
- [Fonts and text](#fonts-and-text)
- [Tables](#tables)
- [Images and SVG](#images-and-svg)
- [Rendering pipeline](#rendering-pipeline)
- [Benchmark](#benchmark)
- [Supported image formats](#supported-image-formats)

## Requirements and getting started

The project runs on Node.js and uses TSX with its own JSX runtime. The demo generates `output.pdf`; it loads a sample image over HTTP and therefore requires network access:

```sh
npm install
npm run dev
```

For TSX, configure `jsx` and `jsxFragmentFactory` to use the runtime. The included [`tsconfig.json`](./tsconfig.json) sets `jsxFactory: "jsx"` and `jsxFragmentFactory: "fragment"`.

```tsx
import { fragment, jsx } from "./jsx";
import { pdf, pdfStreamToBuffer, pdfStreamToDisk } from "./pdf";
```

`jsx` and `fragment` are part of the JSX runtime and are imported directly from `./jsx`. The `./pdf` entry point exports only the three functions in the public PDF API. Although `pdf()` returns a standard web stream, the current implementation requires Node.js, including for file and image processing.

## Public API

The examples below use the stream from the quick start. `document` represents your JSX document tree, and `fonts` is its font map.

### `pdf(element, options?)`

Renders a document and returns a `ReadableStream<Uint8Array>`. The stream can be passed directly as a web `Response` body:

```ts
const response = new Response(stream, {
  headers: {
    "content-type": "application/pdf",
    "content-disposition": 'inline; filename="report.pdf"',
  },
});
```

### `pdfStreamToDisk(stream, path)`

Writes the stream to a file in chunks and returns a `Promise<void>`. This avoids also holding the entire PDF in memory as a buffer:

```ts
await pdfStreamToDisk(pdf(document, { fonts }), "report.pdf");
```

### `pdfStreamToBuffer(stream)`

Reads the entire stream and returns a Node.js `Buffer`. This is useful for APIs that expect a buffer; the complete PDF contents are held in memory:

```ts
const buffer = await pdfStreamToBuffer(stream);
```

A stream can only be read once. To send it to multiple destinations, render the document again with `pdf(...)` for each destination.

## Documents and pages

Wrap a document in `<document>`. It can include metadata for PDF readers:

```tsx
<document
  title="Quarterly report"
  author="Northwind Studio"
  subject="Quarterly performance"
  keywords={["quarterly", "performance"]}
  creator="Northwind Reporting"
  producer="Northwind Reporting"
  creationDate={new Date()}
  modificationDate={new Date()}
  language="en-US"
>
  {/* pages */}
</document>
```

Supported metadata fields are `title`, `author`, `subject`, `keywords`, `creator`, `producer`, `creationDate`, `modificationDate`, and `language`. `keywords` can be a string or an array; date values can be `Date` objects or valid date strings.

Each `<page>` can set a paper size, orientation, and its own padding:

```tsx
<page size="A4" orientation="landscape" style={{ padding: 40 }}>
  <p>Page content</p>
</page>
```

Predefined sizes are `A0` through `A6`, `LETTER`, `LEGAL`, and `TABLOID`. A custom size can be supplied as `[width, height]`; dimensions are processed internally in PDF points. Orientation can be `portrait` or `landscape`.

The renderer targets PDF/A-2u and writes XMP metadata and an sRGB output intent. Text requires suitable embedded TrueType fonts.

## Layout and positioning

`<div>` is the general-purpose layout container, and `<p>` is a paragraph. Children are not automatically arranged using flex layout. Set `display: "flex"` explicitly:

```tsx
<div
  style={{
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  }}
>
  <p>Left</p>
  <p>Right</p>
</div>
```

Supported properties include `flexDirection`, `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `justifyContent`, `alignItems`, `alignSelf`, `gap`, `rowGap`, and `columnGap`. Grid layouts use `display: "grid"` and `gridTemplateColumns`, with fixed, `fr`, and `auto` columns, as well as `repeat(...)`.

`margin`, `padding`, individual sides, and horizontal and vertical shorthands are normalized. Unset spacing defaults to `0`; background and text colors default to white and black. Numeric layout dimensions are in PDF points. Colors can be CSS color names or hex values; a `border` shorthand such as `"2pt solid red"` is expanded into individual sides.

| `position` | Behavior |
| --- | --- |
| `static` | Participates in normal document flow |
| `relative` | Offsets the box from its calculated position while keeping it in the flow |
| `absolute` | Is removed from the flow and aligned to the nearest positioned ancestor |
| `fixed` | Is aligned to the page and repeated on every output page |

Create dynamic footers with `<page-number />` and `<pages-total />`:

```tsx
<div
  style={{
    position: "fixed",
    left: 32,
    right: 32,
    bottom: 20,
    display: "flex",
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 4,
  }}
>
  <page-number />
  <p>of</p>
  <pages-total />
</div>
```

## Fonts and text

Register TTF fonts through `fonts`. The key is used as `fontFamily`. Text metrics are calculated from the glyph widths in the font file, and the same TTF file is embedded in the PDF. Every text font family used in the document needs a matching font.

```tsx
const roboto = new Uint8Array(await readFile("fonts/Roboto.ttf"));

const stream = pdf(
  <document style={{ fontFamily: "Roboto" }}>
    <page>
      <p style={{ fontSize: 18, lineHeight: 24 }}>
        Text is measured and wrapped using the actual glyph widths from the TTF font.
      </p>
      <p style={{ fontWeight: "bold" }}>Bold text</p>
    </page>
  </document>,
  { fonts: { Roboto: { 400: roboto } } },
);
```

Register available faces with their numeric weights. `"normal"` maps to 400 and `"bold"` maps to 600; numeric `fontWeight` values use the closest registered face. If a heavier face is missing, bold is synthesized.

```tsx
const robotoRegular = new Uint8Array(await readFile("fonts/Roboto.ttf"));
const robotoBold = new Uint8Array(await readFile("path/to/Roboto-Bold.ttf"));

const stream = pdf(document, {
  fonts: { Roboto: { 400: robotoRegular, 600: robotoBold } },
});
```

A single TTF file can still be specified directly under the family name; it is treated as weight 400. Unicode text is embedded with a ToUnicode mapping. Only glyphs actually used are included in the PDF; PDF content and metadata streams are compressed with Flate.

Inline text styles support `<span>`, `<strong>`, `<b>`, `<em>`, and `<i>`. `<ul>`, `<ol>`, and `<li>` generate list markers. Set vertical text with `writingMode: "vertical-rl"` or `"vertical-lr"`. `letterSpacing` controls additional character spacing in points; spacing is included in text width, wrapping, and rendering:

```tsx
<p style={{ letterSpacing: 1.2 }}>
  Text with additional spacing between characters
</p>
```

## Tables

Tables use `<table>`, `<tr>`, `<th>`, and `<td>`. The optional `columns` property sets column widths; `rowSpan` and `colSpan` merge cells. Table headers using `<th>` are repeated on subsequent pages.

```tsx
<table columns={[90, 150, 300]}>
  <tr>
    <th>Quarter</th>
    <th>Initiative</th>
    <th>Update</th>
  </tr>
  <tr>
    <td>Q1</td>
    <td>Onboarding</td>
    <td>The new customer flow is live.</td>
  </tr>
  <tr>
    <td rowSpan={2}>Q2</td>
    <td>Reliability</td>
    <td>Service availability improved.</td>
  </tr>
  <tr>
    <td colSpan={2}>Analytics rollout is in progress.</td>
  </tr>
</table>
```

A cell can use vertical writing:

```tsx
<th style={{ writingMode: "vertical-rl", textAlign: "center" }}>SPRINT</th>
```

## Images and SVG

`<img src={...} />` accepts HTTP(S) and data URLs, Node.js `Buffer`/`Uint8Array`, `ArrayBuffer`, `Blob`, and file paths. Supported formats are JPEG and non-interlaced 8-bit PNG in RGB, RGBA, grayscale, and grayscale with alpha. GIF is not supported. If either `width` or `height` is set, the aspect ratio is preserved.

```tsx
<img src="https://example.com/photo.jpg" style={{ width: 240 }} />
<img src={imageBytes} style={{ width: 240 }} />
<img src="./photo.jpg" style={{ width: 240 }} />
```

SVGs can be added directly as JSX vectors or loaded from an SVG URL, SVG data URL, or `.svg` file path. The supported SVG subset includes groups, paths, rectangles, circles, ellipses, lines, polylines, polygons, and text, along with fills, strokes, stroke styles, and basic transforms (`matrix`, `translate`, `scale`, `rotate`, `skewX`, `skewY`). SVG filters, masks, and gradients are not rendered.

```tsx
<svg width="240" height="120" viewBox="0 0 240 120">
  <rect x="4" y="4" width="232" height="112" rx="12" fill="#eff8ff" stroke="#175cd3" strokeWidth="2" />
  <circle cx="48" cy="60" r="22" fill="#ff69b4" />
  <path d="M 90 80 C 120 20 160 100 205 40" fill="none" stroke="#7c3aed" strokeWidth="4" />
</svg>
```

## Rendering pipeline

`pdf()` runs these steps in order:

1. `resolve` evaluates synchronous and asynchronous components and loads image sources.
2. `normalize` standardizes styles, colors, spacing, tables, and lists.
3. `layout` calculates widths, measures and wraps text, calculates heights and positions, and splits explicit pages into cooperative chunks.
4. `paginate` creates pages and converts positions to page-local coordinates.
5. `postprocess` sets final page numbers and corrects affected row layouts.
6. `render` writes metadata, fonts, images, and pages to the PDF stream.

## Benchmark

The benchmark renders 10,000 pages with text, Roboto, fixed headers and footers, and page numbers:

```sh
npx tsx benchmark-10000-pages.tsx
```

It generates `benchmark-10000-pages.pdf` and `benchmark-10000-pages.json`. The report includes runtime, RSS, heap, external memory, and maximum event-loop delay. The measurement includes the generated input tree; results depend on the Node.js version and hardware.

## Supported image formats

| Format | Support |
| --- | --- |
| JPEG/JPG | Supported; grayscale and RGB JPEG |
| PNG | Non-interlaced, 8-bit: RGB, RGBA, grayscale, and grayscale with alpha |
| SVG | Subset supported as JSX, URL, or SVG data URL |
| GIF | Not supported |

The included `fonts/Roboto.ttf` comes from Google Fonts; its SIL Open Font License is in [`fonts/OFL.txt`](./fonts/OFL.txt).

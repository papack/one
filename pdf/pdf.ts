import type { JSXElement } from "../jsx/jsx";
import { layout } from "./layout";
import { postprocess } from "./postprocess";
import { getPdfDocumentContext } from "./context";
import {
  collectPdfImages,
  createFontMap,
  type FontFamilySource,
} from "./fonts";
import { render } from "./render";
import { resolve } from "./resolve";

export type PdfOptions = {
  /** Maps font families to one TTF or to TTF sources keyed by numeric weight. */
  fonts?: Record<string, FontFamilySource>;
};

/** Orchestrates the PDF pipeline and returns its output as a web ReadableStream. */
export function pdf(
  element: JSXElement,
  options: PdfOptions = {},
): ReadableStream<Uint8Array> {
  return createPdfStream((writer) => renderPdf(element, writer, options));
}

/** Starts the PDF pipeline in a web stream and forwards failures to its reader. */
function createPdfStream(
  runPipeline: (
    writer: WritableStreamDefaultWriter<Uint8Array>,
  ) => Promise<void>,
): ReadableStream<Uint8Array> {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  void runPipeline(writer).catch(async (error: unknown) => {
    try {
      await writer.abort(error);
    } catch {
      // The readable side may already have been cancelled.
    }
  });
  return readable;
}

async function renderPdf(
  element: JSXElement,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  options: PdfOptions,
): Promise<void> {
  const fonts = createFontMap(options.fonts);
  const resolved = await resolve(element);
  const context = getPdfDocumentContext(resolved);
  const { root, metadata } = context;
  const images = collectPdfImages(root);
  const pages = await layout(resolved, fonts, context);
  const postprocessedPages = postprocess(pages, fonts);
  await render(postprocessedPages, writer, fonts, metadata, images);
}

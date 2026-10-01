import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";

export function toNodeStream(
  stream: Readable | ReadableStream<Uint8Array>,
): Readable {
  if (stream instanceof Readable) return stream;
  // DOM and Node declare different types for the same Web Streams API.
  return Readable.fromWeb(stream as NodeWebReadableStream<Uint8Array>);
}

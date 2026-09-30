import { Buffer } from "node:buffer";
import { open } from "node:fs/promises";

/** Collects a PDF web ReadableStream into one Node.js Buffer. */
export async function pdfStreamToBuffer(
  stream: ReadableStream<Uint8Array>,
): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  let length = 0;
  for await (const chunk of readPdfChunks(stream)) {
    chunks.push(chunk);
    length += chunk.byteLength;
  }
  return Buffer.concat(chunks, length);
}

/** Writes a PDF web ReadableStream to disk without buffering the full file. */
export async function pdfStreamToDisk(
  stream: ReadableStream<Uint8Array>,
  path: string | URL,
): Promise<void> {
  const file = await open(path, "w");
  try {
    for await (const chunk of readPdfChunks(stream)) {
      let offset = 0;
      while (offset < chunk.byteLength) {
        const { bytesWritten } = await file.write(
          chunk,
          offset,
          chunk.byteLength - offset,
        );
        if (bytesWritten === 0)
          throw new Error("Could not write PDF data to disk.");
        offset += bytesWritten;
      }
    }
  } finally {
    await file.close();
  }
}

async function* readPdfChunks(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<Uint8Array> {
  const reader = stream.getReader();
  let completed = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        completed = true;
        return;
      }
      yield value;
    }
  } finally {
    if (!completed) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

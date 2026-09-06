import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import type { StorageObject, StoragePort, UUID } from "./types";

/** Ephemeral storage implementation, useful for tests and short-lived data. */
export class MemoryStorage implements StoragePort {
  private objects = new Map<UUID, Buffer>();
  private maxBytes: number | undefined;

  constructor(options: { maxFileSizeInMegaByte?: number } = {}) {
    const maxSize = options.maxFileSizeInMegaByte;

    if (maxSize !== undefined && (!Number.isFinite(maxSize) || maxSize < 0)) {
      throw new Error(
        "maxFileSizeInMegaByte must be a non-negative finite number",
      );
    }

    this.maxBytes = maxSize === undefined ? undefined : maxSize * 1024 * 1024;
  }

  async write(data: StorageObject): Promise<UUID> {
    const uuid = randomUUID();
    const object = Buffer.isBuffer(data)
      ? Buffer.from(data)
      : await this.readStream(data);

    this.ensureWithinLimit(object.byteLength);
    this.objects.set(uuid, object);
    return uuid;
  }

  async read(
    uuid: UUID,
    options?: { output?: "buffer" | "stream" },
  ): Promise<Buffer | Readable> {
    const object = this.objects.get(uuid);

    if (!object) {
      throw new Error(`Object not found: ${uuid}`);
    }

    const copy = Buffer.from(object);
    return options?.output === "stream" ? Readable.from(copy) : copy;
  }

  async exists(uuid: UUID): Promise<boolean> {
    return this.objects.has(uuid);
  }

  async delete(uuid: UUID): Promise<void> {
    if (!this.objects.delete(uuid)) {
      throw new Error(`Cannot delete. Object not found: ${uuid}`);
    }
  }

  private async readStream(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let bytes = 0;

    for await (const chunk of stream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.byteLength;
      this.ensureWithinLimit(bytes);
      chunks.push(buffer);
    }

    return Buffer.concat(chunks);
  }

  private ensureWithinLimit(bytes: number): void {
    if (this.maxBytes !== undefined && bytes > this.maxBytes) {
      throw new Error(`File too large. Max is ${this.maxBytes} bytes.`);
    }
  }
}

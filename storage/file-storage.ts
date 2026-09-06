import { randomUUID } from "node:crypto";
import { constants, createReadStream, createWriteStream } from "node:fs";
import {
  access,
  mkdir,
  open,
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import type { StorageObject, StoragePort, UUID } from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Persists objects as UUID-named files in a local directory. */
export class FileStorage implements StoragePort {
  private maxBytes: number | undefined;
  private basePath: string;

  constructor(options: { basePath: string; maxFileSizeInMegaByte?: number }) {
    this.basePath = options.basePath;
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
    const filePath = this.resolve(uuid);
    await mkdir(this.basePath, { recursive: true });

    if (Buffer.isBuffer(data)) {
      this.ensureWithinLimit(data.byteLength);
      await writeFile(filePath, data);
      return uuid;
    }

    return this.writeStream(data, filePath, uuid);
  }

  async read(
    uuid: UUID,
    options?: { output?: "buffer" | "stream" },
  ): Promise<Buffer | Readable> {
    const filePath = this.resolve(uuid);

    if (options?.output === "stream") {
      try {
        const file = await open(filePath, "r");
        return createReadStream(filePath, { fd: file.fd, autoClose: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          throw new Error(`Object not found: ${uuid}`);
        }
        throw error;
      }
    }

    try {
      return await readFile(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`Object not found: ${uuid}`);
      }
      throw error;
    }
  }

  async exists(uuid: UUID): Promise<boolean> {
    try {
      await access(this.resolve(uuid), constants.F_OK);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }

  async delete(uuid: UUID): Promise<void> {
    try {
      await unlink(this.resolve(uuid));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`Cannot delete. Object not found: ${uuid}`);
      }
      throw error;
    }
  }

  private resolve(uuid: UUID): string {
    if (!UUID_PATTERN.test(uuid)) throw new Error("Invalid object ID");
    return join(this.basePath, uuid);
  }

  private ensureWithinLimit(bytes: number): void {
    if (this.maxBytes !== undefined && bytes > this.maxBytes) {
      throw new Error(`File too large. Max is ${this.maxBytes} bytes.`);
    }
  }

  private writeStream(
    stream: Readable,
    filePath: string,
    uuid: UUID,
  ): Promise<UUID> {
    return new Promise((resolve, reject) => {
      let bytes = 0;
      let settled = false;
      const output = createWriteStream(filePath);

      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        const cleanup = () =>
          unlink(filePath)
            .catch(() => {})
            .finally(() => reject(error));
        if (output.closed) cleanup();
        else {
          output.once("close", cleanup);
          stream.destroy();
          output.destroy();
        }
      };

      stream.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        try {
          this.ensureWithinLimit(bytes);
        } catch (error) {
          fail(error as Error);
        }
      });
      stream.on("error", fail);
      output.on("error", fail);
      output.on("close", () => {
        if (!settled) {
          settled = true;
          resolve(uuid);
        }
      });
      stream.pipe(output);
    });
  }
}

import type { Readable } from "node:stream";

/** Identifier returned when an object is stored. */
export type UUID = string;

/** Data accepted by a storage implementation. */
export type StorageObject = Buffer | Readable;

/** Backwards-compatible name for data accepted by storage implementations. */
export type StorageObjectType = StorageObject;

/**
 * Swappable object-storage contract.
 *
 * Implementations can persist objects in memory, on disk, or in a remote service
 * while callers keep the same Buffer/stream API.
 */
export interface StoragePort {
  /** Store an object and return its generated ID. */
  write(data: StorageObject): Promise<UUID>;

  /** Read an object as a Buffer (default) or a Node.js stream. */
  read(
    uuid: UUID,
    options?: { output?: "buffer" | "stream" },
  ): Promise<Buffer | Readable>;

  /** Return whether an object exists. */
  exists(uuid: UUID): Promise<boolean>;

  /** Permanently remove an object. */
  delete(uuid: UUID): Promise<void>;
}

/** Backwards-compatible name for the storage contract. */
export type StoragePortInterface = StoragePort;

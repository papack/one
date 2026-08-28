import { SessionStorageEntryNotFoundError } from "./errors";
import { SessionStoragePortInterface } from "./session-storage-port-interface.ts";

export class MapSessionStorage<T> implements SessionStoragePortInterface<T> {
  private readonly storage = new Map<string, T>();

  async get(key: string): Promise<T> {
    const value = this.storage.get(key);

    if (value === undefined) {
      throw new SessionStorageEntryNotFoundError(key);
    }

    return structuredClone(value);
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async has(key: string): Promise<boolean> {
    return this.storage.has(key);
  }

  async set(key: string, value: T): Promise<void> {
    this.storage.set(key, structuredClone(value));
  }
}

import { SessionStorageEntryNotFoundError } from "./errors";
import { SessionStoragePortInterface } from "./session-storage-port-interface.ts";

export class MapSessionStorage<T> implements SessionStoragePortInterface<T> {
  private readonly storage = new Map<string, T>();

  get(key: string): T {
    const value = this.storage.get(key);

    if (value === undefined) {
      throw new SessionStorageEntryNotFoundError(key);
    }

    return value;
  }

  delete(key: string): void {
    this.storage.delete(key);
  }

  has(key: string): boolean {
    return this.storage.has(key);
  }

  set(key: string, value: T): void {
    this.storage.set(key, value);
  }
}

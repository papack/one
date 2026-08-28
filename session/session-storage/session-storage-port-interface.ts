export interface SessionStoragePortInterface<T> {
  get: (key: string) => Promise<T>; // throw if session not found
  delete: (key: string) => Promise<void>;
  has: (key: string) => Promise<boolean>;
  set: (key: string, value: T) => Promise<void>;
}

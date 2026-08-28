export interface SessionStoragePortInterface<T> {
  get: (key: string) => T; // throw if session not found
  delete: (key: string) => void;
  has: (key: string) => boolean;
  set: (key: string, value: T) => void;
}

export class SessionStorageEntryNotFoundError extends Error {
  constructor(key: string) {
    super(`Session storage entry "${key}" not found.`);
    this.name = "SessionStorageEntryNotFoundError";
  }
}

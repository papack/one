export class CookieNotFoundError extends Error {
  constructor(key: string) {
    super(`Cookie "${key}" not found.`);
    this.name = "CookieNotFoundError";
  }
}

const CHARACTERS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function generateRandomString(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => CHARACTERS[byte & 63]).join("");
}

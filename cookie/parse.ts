export function parse(cookies: string, key: string): string {
  const encodedKey = encodeURIComponent(key);

  for (const cookie of cookies.split(";")) {
    const [name, ...value] = cookie.trim().split("=");

    if (name === encodedKey) {
      return decodeURIComponent(value.join("="));
    }
  }

  throw new CookieNotFoundError(key);
}

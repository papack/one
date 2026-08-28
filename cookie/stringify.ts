export interface StringifyCookieOptions {
  expires?: Date;
  maxAge?: number;
  domain?: string;
  path?: string;
  secure?: boolean;
  sameSite?: "strict" | "lax" | "none";
}

export function stringify(
  key: string,
  value: string,
  options: StringifyCookieOptions = {},
): string {
  const parts = [`${encodeURIComponent(key)}=${encodeURIComponent(value)}`];

  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }

  if (options.path) {
    parts.push(`Path=${options.path}`);
  }

  if (options.secure) {
    parts.push("Secure");
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }

  return parts.join("; ");
}

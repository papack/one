import { cookie } from "../cookie";
import { crypto } from "../crypto";
import { type SessionStoragePortInterface } from "./session-storage";

export interface SessionState<T> {
  readonly id: string;
  readonly cookie: string;
  readonly isNew: boolean;
  values: T;
}

export interface SessionCookieOptions {
  name?: string;
  path?: string;
  domain?: string;
  expires?: Date;
  maxAge?: number;
  secure?: boolean;
  sameSite?: "strict" | "lax" | "none";
}

export class Session<T> {
  private sessionStorage: SessionStoragePortInterface<T>;
  private createValues: () => T;
  private cookieName: string;
  private cookieOptions: Omit<SessionCookieOptions, "name">;

  constructor(p: {
    sessionStorage: SessionStoragePortInterface<T>;
    createValues: () => T;
    cookie?: SessionCookieOptions;
  }) {
    this.sessionStorage = p.sessionStorage;
    this.createValues = p.createValues;

    const { name = "ssid", ...cookieOptions } = p.cookie ?? {};

    this.cookieName = name;
    this.cookieOptions = cookieOptions;
  }

  async restore(request: Request): Promise<SessionState<T>> {
    const cookies = request.headers.get("cookie");

    if (cookies) {
      let id: string;

      try {
        id = cookie.parse(cookies, this.cookieName);
      } catch {
        // Cookie not found.
        return this.create();
      }

      if (await this.sessionStorage.has(id)) {
        return {
          id,
          values: await this.sessionStorage.get(id),
          cookie: cookie.stringify(this.cookieName, id, this.cookieOptions),
          isNew: false,
        };
      }
    }

    return this.create();
  }

  async save(session: SessionState<T>): Promise<void> {
    await this.sessionStorage.set(session.id, session.values);
  }

  async destroy(session: SessionState<T>): Promise<string> {
    await this.sessionStorage.delete(session.id);

    return cookie.stringify(this.cookieName, "", {
      ...this.cookieOptions,
      expires: new Date(0),
      maxAge: 0,
    });
  }

  private create(): SessionState<T> {
    const id = crypto.generate.string(128);
    const values = this.createValues();

    return {
      id,
      values,
      cookie: cookie.stringify(this.cookieName, id, this.cookieOptions),
      isNew: true,
    };
  }
}

import { Connection, SmtpError } from "./connection";
import { address, message } from "./message";
import type { SmtpConfig, SmtpSendInput } from "./types";

export class Smtp {
  private connection?: Connection;
  private queue: Promise<unknown> = Promise.resolve();
  private pending = 0;
  private idleTimer?: ReturnType<typeof setTimeout>;
  private closing?: Promise<void>;
  private readonly config: SmtpConfig;

  constructor(config: SmtpConfig) {
    address(config.from);
    // eslint-disable-next-line no-control-regex
    if (!config.host || /[\s\x00-\x1f\x7f]/.test(config.host))
      throw new Error("Invalid SMTP host");
    if (
      config.port !== undefined &&
      (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535)
    )
      throw new Error("Invalid SMTP port");
    if (
      config.timeout !== undefined &&
      (!Number.isInteger(config.timeout) ||
        config.timeout < 1 ||
        config.timeout > 2_147_483_647)
    )
      throw new Error("Invalid SMTP timeout");
    if (
      config.idleTimeout !== undefined &&
      (!Number.isInteger(config.idleTimeout) ||
        config.idleTimeout < 1 ||
        config.idleTimeout > 2_147_483_647)
    )
      throw new Error("Invalid SMTP idleTimeout");
    if ((config.user === undefined) !== (config.pass === undefined))
      throw new Error("Provide both SMTP user and pass");
    if ([config.user, config.pass].some((value) => value?.includes("\0")))
      throw new Error("SMTP credentials must not contain NUL");
    this.config = { ...config };
  }

  private run<T>(operation: () => Promise<T>): Promise<T> {
    clearTimeout(this.idleTimer);
    this.pending++;
    const result = this.queue.then(operation).finally(() => {
      this.pending--;
      if (this.pending === 0 && this.connection && !this.closing) {
        this.idleTimer = setTimeout(() => {
          void this.run(() => this.release());
        }, this.config.idleTimeout ?? 60_000);
        this.idleTimer.unref();
      }
    });
    this.queue = result.catch(() => {});
    return result;
  }

  private async failed(error: unknown): Promise<never> {
    this.connection?.close();
    this.connection = undefined;
    const failure = error instanceof Error ? error : new Error(String(error));
    try {
      await this.config.onError?.(failure);
    } catch {
      /* Preserve the original failure. */
    }
    throw failure;
  }

  private async connect(): Promise<Connection> {
    if (this.connection) {
      try {
        // Probe reused connections before starting a mail transaction. It is safe
        // to reconnect here because no message data has been sent yet.
        await this.connection.command("NOOP", [250]);
        return this.connection;
      } catch {
        this.connection.close();
        this.connection = undefined;
      }
    }
    const connection = new Connection(this.config);
    this.connection = connection;
    await connection.expect([220]);
    let hello = await connection.command("EHLO localhost", [250]);
    let encrypted = this.config.secure === true;
    if (
      !encrypted &&
      hello.lines.slice(1).some((line) => /^STARTTLS(?:\s|$)/i.test(line))
    ) {
      await connection.command("STARTTLS", [220]);
      await connection.upgrade();
      encrypted = true;
      hello = await connection.command("EHLO localhost", [250]);
    }
    if (!encrypted && this.config.requireTLS !== false)
      throw new SmtpError("SMTP server does not offer STARTTLS");
    if (this.config.user !== undefined) {
      if (!encrypted) throw new SmtpError("SMTP authentication requires TLS");
      const auth = hello.lines
        .slice(1)
        .filter((line) => /^AUTH[ =]/i.test(line))
        .flatMap((line) => line.slice(5).toUpperCase().split(/\s+/));
      if (auth.includes("PLAIN")) {
        const credentials = Buffer.from(
          `\0${this.config.user}\0${this.config.pass}`,
        ).toString("base64");
        const reply = await connection.command(
          `AUTH PLAIN ${credentials}`,
          [235, 334],
        );
        if (reply.code === 334) await connection.command(credentials, [235]);
      } else if (auth.includes("LOGIN")) {
        await connection.command("AUTH LOGIN", [334]);
        await connection.command(
          Buffer.from(this.config.user).toString("base64"),
          [334],
        );
        await connection.command(
          Buffer.from(this.config.pass!).toString("base64"),
          [235],
        );
      } else
        throw new SmtpError(
          "SMTP server supports neither AUTH PLAIN nor LOGIN",
        );
    }
    return connection;
  }

  send(input: SmtpSendInput): Promise<void> {
    if (this.closing) return Promise.reject(new Error("Smtp is closed"));
    return this.run(async () => {
      try {
        const mail = message(this.config.from, input);
        const connection = await this.connect();
        await connection.command(`MAIL FROM:<${mail.sender}>`, [250]);
        for (const recipient of mail.recipients) {
          await connection.command(`RCPT TO:<${recipient}>`, [250, 251, 252]);
        }
        await connection.command("DATA", [354]);
        // Acceptance is confirmed only by the final 250 response. Never retry automatically.
        await connection.command(mail.data.replace(/^\./gm, "..") + ".", [250]);
      } catch (error) {
        await this.failed(error);
      }
    });
  }

  /** Wait for queued sends, then permanently close this instance. */
  close(): Promise<void> {
    this.closing ??= this.run(() => this.release());
    return this.closing;
  }

  private async release(): Promise<void> {
    // Closing cannot turn an already accepted message into a send failure.
    try {
      await this.connection?.command("QUIT", [221]);
    } catch {
      // The peer may already have closed the connection.
    } finally {
      this.connection?.close();
      this.connection = undefined;
    }
  }
}

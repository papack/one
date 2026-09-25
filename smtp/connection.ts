import { connect, isIP, type Socket } from "node:net";
import { connect as connectTLS, type TLSSocket } from "node:tls";
import type { SmtpConfig } from "./types";

type Reply = { code: number; lines: string[] };

export class SmtpError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
  ) {
    super(message);
    this.name = "SmtpError";
  }
}

/** One command at a time; Smtp serializes access to this connection. */
export class Connection {
  private socket: Socket | TLSSocket;
  private buffer = "";
  private lines: string[] = [];
  private code?: number;
  private failure?: Error;
  private replies: Reply[] = [];
  private pending?: {
    resolve: (reply: Reply) => void;
    reject: (error: Error) => void;
  };
  private readonly timeout: number;

  constructor(private readonly config: SmtpConfig) {
    this.timeout = config.timeout ?? 30_000;
    const options = {
      host: config.host,
      port: config.port ?? (config.secure ? 465 : 587),
    };
    this.socket = config.secure
      ? connectTLS({ ...options, ...this.tlsOptions() })
      : connect(options);
    this.attach();
  }

  private tlsOptions() {
    return {
      host: this.config.host,
      servername: isIP(this.config.host) ? undefined : this.config.host,
      ca: this.config.ca,
      minVersion: "TLSv1.2" as const,
    };
  }

  private fail = (error: Error) => {
    this.failure ??= error;
    this.pending?.reject(this.failure);
    this.pending = undefined;
    this.socket.destroy();
  };

  private closed = () => this.fail(new SmtpError("SMTP connection closed"));

  private receive = (chunk: Buffer) => {
    this.buffer += chunk.toString("ascii");
    if (this.buffer.length > 65_536)
      return this.fail(new SmtpError("SMTP response too large"));
    let end: number;
    while ((end = this.buffer.indexOf("\r\n")) !== -1) {
      const line = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end + 2);
      const match = /^(\d{3})([ -])(.*)$/.exec(line);
      if (
        !match ||
        (this.code !== undefined && this.code !== Number(match[1]))
      ) {
        return this.fail(new SmtpError("Malformed SMTP response"));
      }
      this.code = Number(match[1]);
      this.lines.push(match[3]);
      if (this.lines.length > 100)
        return this.fail(new SmtpError("SMTP response too large"));
      if (match[2] === " ") {
        const reply = { code: this.code, lines: this.lines };
        this.lines = [];
        this.code = undefined;
        if (this.pending) {
          const pending = this.pending;
          this.pending = undefined;
          pending.resolve(reply);
        } else {
          this.replies.push(reply);
          if (this.replies.length > 10)
            return this.fail(new SmtpError("Unexpected SMTP responses"));
        }
      }
    }
  };

  private attach() {
    this.socket.on("data", this.receive);
    this.socket.on("error", this.fail);
    this.socket.on("close", this.closed);
  }

  private read(): Promise<Reply> {
    if (this.failure) return Promise.reject(this.failure);
    const reply = this.replies.shift();
    if (reply) return Promise.resolve(reply);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => this.fail(new SmtpError("SMTP response timed out")),
        this.timeout,
      );
      this.pending = {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      };
    });
  }

  async expect(codes: number[]): Promise<Reply> {
    const reply = await this.read();
    if (!codes.includes(reply.code)) {
      // Do not echo server replies: they can contain credentials or message content.
      throw new SmtpError(
        `Unexpected SMTP status ${reply.code}; expected ${codes.join("/")}`,
        reply.code,
      );
    }
    return reply;
  }

  command(command: string, codes: number[]): Promise<Reply> {
    if (this.failure) return Promise.reject(this.failure);
    this.socket.write(`${command}\r\n`);
    return this.expect(codes);
  }

  async upgrade(): Promise<void> {
    if (this.failure) throw this.failure;
    if (this.buffer || this.lines.length || this.replies.length)
      throw new SmtpError("Unexpected data after STARTTLS");
    const plain = this.socket;
    plain.removeListener("data", this.receive);
    plain.removeListener("error", this.fail);
    plain.removeListener("close", this.closed);
    const socket = connectTLS({ socket: plain, ...this.tlsOptions() });
    this.socket = socket;
    this.attach();
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => this.fail(new SmtpError("SMTP TLS handshake timed out")),
        this.timeout,
      );
      const cleanup = () => {
        clearTimeout(timer);
        socket.removeListener("secureConnect", ready);
        socket.removeListener("error", failed);
        socket.removeListener("close", closed);
      };
      const ready = () => {
        cleanup();
        resolve();
      };
      const failed = (error: Error) => {
        cleanup();
        reject(error);
      };
      const closed = () =>
        failed(
          this.failure ??
            new SmtpError("SMTP connection closed during TLS handshake"),
        );
      socket.once("secureConnect", ready);
      socket.once("error", failed);
      socket.once("close", closed);
    });
  }

  close() {
    this.socket.destroy();
  }
}

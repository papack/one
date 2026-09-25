export type Attachment = {
  filename: string;
  contentType: string;
  buffer: Buffer;
};

export type SmtpConfig = {
  from: string;
  host: string;
  port?: number;
  /** Implicit TLS (usually port 465). Otherwise use STARTTLS. */
  secure?: boolean;
  /** Defaults to true. Set false only for a trusted, unauthenticated relay. */
  requireTLS?: boolean;
  user?: string;
  pass?: string;
  /** Timeout for each SMTP response / TLS handshake, in milliseconds. */
  timeout?: number;
  /** Close the connection after this many idle milliseconds. Defaults to 60,000. */
  idleTimeout?: number;
  /** Custom trusted CA certificates, replacing Node's default CA list. */
  ca?: string | Buffer | (string | Buffer)[];
  onError?: (error: Error) => void | Promise<void>;
};

export type SmtpSendInput = {
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text?: string;
  html?: string;
  /** Alias for HTML. Render JSX using @papack/one/html before sending. */
  content?: string;
  attachments?: Attachment[];
};

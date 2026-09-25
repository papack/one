# SMTP

Dependency-free SMTP sending using Node's built-in TCP, TLS and crypto modules.

```ts
import { Smtp } from "@papack/one/smtp";

const smtp = new Smtp({
  from: "My App <hello@example.com>",
  host: "smtp.example.com",
  port: 587,
  secure: false, // STARTTLS; use true for implicit TLS on port 465
  user: process.env.SMTP_USER!,
  pass: process.env.SMTP_PASS!,
  idleTimeout: 60_000, // optional; milliseconds since the queue became idle
  onError: async (error) => console.error(error), // optional
});

// Share this instance through dependency injection; endpoints only call send().
await smtp.send({
  to: ["recipient@example.com"],
  subject: "Hello",
  text: "Hello from my app!",
  html: "<p>Hello from my app!</p>",
  // cc, bcc and attachments are optional
  attachments: [
    {
      filename: "hello.txt",
      contentType: "text/plain",
      buffer: Buffer.from("Hello!"),
    },
  ],
});

// Optional, only when shutting down the application:
await smtp.close();
```

`Smtp` is also exported from `@papack/one`. For existing JSX templates, render
them with `await html(...)` from `@papack/one/html` and pass the resulting string
automatically converted to plain text. Providing both creates a MIME alternative.

## Connection and security

- `secure: true` uses implicit TLS and defaults to port 465. Otherwise port 587
  is used and STARTTLS is required by default. Capabilities are refreshed after TLS.
- Certificates and hostnames are verified. `ca` accepts custom CA certificates,
  replacing Node's default CA list. TLS 1.2 or newer is required.
- `requireTLS: false` permits plaintext only for a trusted relay. STARTTLS is
  still used if advertised. Authentication always requires TLS.
- `user` and `pass` must be provided together. AUTH PLAIN and LOGIN are supported;
  OAuth2 is outside this module's scope.
- `timeout` defaults to 30,000 ms for each response, including the greeting,
  and the STARTTLS handshake. Closing also waits at most this long for QUIT.
- `send()` connects and authenticates on demand, then reuses the connection.
  Before reuse, a NOOP checks the connection; if it fails, a new connection is
  established before starting the message transaction.
- `idleTimeout` defaults to 60,000 ms and must be a positive integer. The idle
  timer runs only when no sends are active or queued. After it expires, the
  connection closes automatically; the next send opens a new connection.
- Calls on a Smtp instance are serialized with no queue size limit. Multiple
  instances can send in parallel. Each send waits for its own SMTP confirmation.
- A connection or send error rejects that send and closes the connection. The
  next queued send can connect again; the failed message is never automatically
  resent. A connection can still fail between the NOOP check and sending; that
  send rejects as well.
- Optional `await smtp.close()` stops accepting new sends, waits for already
  queued sends, and closes the connection. It is idempotent and permanently
  closes the instance. Use it when shutting down, not at the end of each request.
- `onError` receives connection/send errors; those errors also reject the call.
  An error in the callback does not replace the original error. A send after
  `close()` rejects directly. A failed reuse probe is handled by reconnecting;
  it is not reported if the subsequent connection and send succeed.

## Message behavior

Recipients are arrays of ASCII email addresses or `Name <address@example.com>`.
At least one recipient across `to`, `cc`, and `bcc` is required. Unicode display
names, subjects, content and attachment filenames are encoded. International
domain names must use punycode; international local parts, quoted local parts,
groups and SMTPUTF8 are unsupported. Control characters in headers are rejected.

BCC addresses are sent only in the SMTP envelope. All recipients must be accepted
before DATA is sent. A successful `send()` means the SMTP server accepted the
message, not that the recipient received it. If the connection fails after DATA,
delivery may be uncertain; the client does not automatically retry.

Attachments are Buffers and messages are assembled in memory. Streaming large
attachments is not supported. No credentials or SMTP settings are stored by the
library outside the Smtp instance.

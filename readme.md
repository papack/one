# @papack/one

**A small, server-first TypeScript toolkit for rendering HTML and optional CSR islands with web standards.**

`@papack/one` keeps the application on the server: routes receive a standard
`Request`, return a standard `Response`, and render HTML directly. Browser-only
DOM islands are available through the separate `@papack/one/dom` entry point.

## Highlights

- Node HTTP server with the familiar `Request` / `Response` API
- Server-side HTML and JSX rendering, including async components
- Lightweight client-side DOM renderer with signals, lifecycle hooks, and helpers
- Lightweight layout, style and design-token utilities
- Swappable object storage for Buffers and Node.js streams
- Dependency-free SMTP mail delivery with TLS, HTML, text and attachments
- Synchronous, typed schemas for validating request and application data

## Install

```bash
npm install @papack/one
```

## Compose your app

You define the application object yourself. Features receive it in `init`, so they can register routes and use the services your application chooses to provide.

```tsx
import { Router } from "@papack/one";
import { html } from "@papack/one/html";
import { jsx } from "@papack/one/jsx";

const app = {
  router: new Router({
    notFound: async () => new Response("Not found", { status: 404 }),
    internalServerError: async () =>
      new Response("Internal server error", { status: 500 }),
  }),
};

type App = typeof app;

class HomeFeature {
  async init(app: App) {
    await app.router.add("GET", "/", async () => {
      const page = await html(
        <main>
          <h1>Hello from the server</h1>
          <p>This page was rendered without a client runtime.</p>
        </main>,
      );

      return new Response(page, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    });
  }
}

await new HomeFeature().init(app);

app.router.listen(3000, () => {
  console.log("Listening on http://localhost:3000");
});
```

For JSX, configure TypeScript to use the package factory:

```json
{
  "compilerOptions": {
    "jsx": "react",
    "jsxFactory": "jsx",
    "jsxFragmentFactory": "fragment"
  }
}
```

## DOM islands

`@papack/one/dom` is a browser-only renderer for interactive CSR islands. Keep
it out of server-side route modules; import the JSX factory from
`@papack/one/jsx` in modules that contain JSX.

```tsx
import { jsx } from "@papack/one/jsx";
import { dom, signal, Show } from "@papack/one/dom";

const [visible, setVisible] = signal(true);

function Counter() {
  return (
    <section>
      <button onClick={() => void setVisible((value) => !value)}>
        Toggle message
      </button>
      <Show when={visible}>
        <p>This part is mounted and destroyed reactively.</p>
      </Show>
    </section>
  );
}

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing #app element");

dom(<Counter />, { parent: root });
```

The DOM entry point also exports `For`, `Repeat`, `Portal`, lifecycle helpers,
and browser hooks such as `useLocalStorage`, `useNavigate`, and `useUrlParam`.

## Sessions

Sessions use a storage adapter you provide. `MapSessionStorage` is useful for local development; use a durable adapter in production.

```ts
import { MapSessionStorage, Session } from "@papack/one";

const session = new Session({
  sessionStorage: new MapSessionStorage<{ visits: number }>(),
  createValues: () => ({ visits: 0 }),
  cookie: { name: "session", sameSite: "lax" },
});
```

## Object storage

`FileStorage` stores objects under generated UUIDs; `MemoryStorage` is useful for
tests or ephemeral data. Both support `write`, `read`, `exists`, and `delete`.

```ts
import { FileStorage } from "@papack/one";

const storage = new FileStorage({
  basePath: "./data/objects",
  maxFileSizeInMegaByte: 10,
});

const id = await storage.write(Buffer.from("Hello object storage"));
const object = await storage.read(id); // Buffer
```

## Cache

```ts
import { cache } from "@papack/one/cache";

const [get, clear] = cache(async () => Date.now(), 5_000);
const value = await get(); // Reused for five seconds after loading
clear(); // The next get() loads again
```

Omit the duration to cache indefinitely. Expired values refresh on the next
`get()`; concurrent callers share the same load. See [cache semantics](./cache/readme.md).

## Logging

```ts
import { Logger } from "@papack/one/log";

const log = new Logger({ loglevel: "info" });
await log.info("server", "Started");
```

Use `NullLogger` to discard output. All adapters support `trace`, `info`, `warn`, and `err`.
See [logging adapters and usage with Bus/Cron](./log/readme.md).

## Scheduled tasks

Use `Cron` for minute-based tasks with an explicit lifecycle and optional timezone:

```ts
import { Cron } from "@papack/one/cron";

const cron = new Cron({
  timezone: "Europe/Berlin",
  onError: (error, context) => console.error(context.expression, error),
});
cron.schedule("*/5 * * * *", () => console.log("Every five minutes"));
cron.start();
// Call cron.stop() on shutdown.
```

See [Cron syntax and execution semantics](./cron/readme.md). Tasks run in this
process; missed executions are not replayed and async tasks may overlap.

## Event bus

`Bus` broadcasts events with `emit(topic, data): Promise<void>`. Listeners start
concurrently; await emit to wait for all of them and their error reporting.
Synchronous throws and returned promise rejections go to an optional error handler
and do not reject emit.

```ts
import { Bus } from "@papack/one/bus";

const bus = new Bus<{ "user:created": { id: string } }>();
const id = bus.on("user:created", (user) => console.log(user.id));
await bus.emit("user:created", { id: "123" });
bus.off(id);
```

See [Bus delivery semantics and risks](./bus/readme.md). Events are in memory;
there is no persistence, retry, or concurrency limit.

## SMTP mail

Use `Smtp` from `@papack/one/smtp` to send mail with Node's built-in TCP/TLS
modules. It supports STARTTLS, implicit TLS, AUTH PLAIN/LOGIN, text/HTML, CC/BCC
and Buffer attachments without additional dependencies.

```ts
import { Smtp } from "@papack/one/smtp";

const smtp = new Smtp({
  from: "My App <hello@example.com>",
  host: "smtp.example.com",
  port: 587,
  user: process.env.SMTP_USER!,
  pass: process.env.SMTP_PASS!,
});

await smtp.send({
  to: ["recipient@example.com"],
  subject: "Hello",
  text: "Hello from my app!",
});
```

Connections open automatically and are reused until idle for 60 seconds
(`idleTimeout`). Share one instance across endpoints; concurrent sends are queued.
Use `await smtp.close()` only when shutting down the application.

## Schemas

Schemas validate synchronously and throw a `ValidationError` at the first
invalid value. Use `Infer` to derive the corresponding TypeScript type.

```ts
import { type Infer, isMail, isString, object, value } from "@papack/one";

const userSchema = object({
  name: value(isString),
  email: value(isMail),
});

type User = Infer<typeof userSchema>;
const user: User = userSchema.validate({
  name: "Ada",
  email: "ada@example.com",
});
```

## Status

`@papack/one` is an early, server-first framework. The API may evolve before the first stable release.

## License

[MIT](./license.md)

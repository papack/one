# @papack/one

**A small, server-first TypeScript toolkit for rendering HTML with web standards.**

`@papack/one` keeps the application on the server: routes receive a standard
`Request`, return a standard `Response`, and render HTML directly.

## Highlights

- Node HTTP server with the familiar `Request` / `Response` API
- Server-side HTML and JSX rendering, including async components
- Lightweight layout, style and design-token utilities

## Install

```bash
npm install @papack/one
```

## Compose your app

You define the application object yourself. Features receive it in `init`, so they can register routes and use the services your application chooses to provide.

```tsx
import { html, jsx, Router } from "@papack/one";

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

## Status

`@papack/one` is an early, server-first framework. The API may evolve before the first stable release.

## License

[MIT](./license.md)

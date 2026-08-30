# @papack/one

- use web standards
- everything as vanilla as possible!
- testable
- no client application
- database is user supplied
- server returns html

## usage example

```ts
import { HelloWorld } from "./hello-world";
import { Router } from "../router";
import { MapSessionStorage, Session } from "../session";
export type AppType = typeof app;

const app = {
  router: new Router({
    notFound: async () => new Response("NOT_FOUND", { status: 404 }),
    internalServerError: async () =>
      new Response("INTERNAL_SERVER_ERROR", { status: 500 }),
  }),
  session: new Session({
    sessionStorage: new MapSessionStorage<{ count: number }>(),
    createValues: () => ({
      count: 0,
    }),
    cookie: {},
  }),
};

await new HelloWorld({ app }).init();

app.router.listen(3000, () => {
  console.log("Listen on 3000");
});
```

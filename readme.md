# @papack/one

i try to archive this:

```typescript
const app = {
  router: new Router(), //herbert
  bus: new Bus(), // herbert
  email: new Email(), // herbert
  db: new Database(), // user supplyed
};

//features
await new Shop({ app }).init();
await new Orders({ app }).init();
await new Admin({ app }).init();

app.router.listen(3000);
```

## idea

- web standards
- testable
- no client application
- database is user supplied
- server returns html

```js
this.app.router.add("GET", "/my-route", async () => {
  const product = await this.app.db.getProduct("123");

  return new Response(
    await this.app.html.render(
      <BaseTemplate>
        <button aio-post="/test/124" aio-swap="#abc" />
      </BaseTemplate>,
    ),
  );
});
```

tiny htmx-like (client)runtime:

```text
aio-post="/path"
aio-sse="/events"

aio-swap="#target"
aio-replace="#target"
aio-append="#target"
```

live updates use SSE and HTML fragments.

that's it for now :D

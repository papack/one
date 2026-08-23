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
- everything as vanilla as possible!
- (no htmx, just js scripts)
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


that's it for now :D

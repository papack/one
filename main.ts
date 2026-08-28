import { HelloWorld } from "./playground/hello-world";
import { Router } from "./router";
import { MapSessionStorage, Session } from "./session";
export type AppType = typeof app;

const app = {
  router: new Router({
    notFound: async () => new Response("NOT_FOUND", { status: 404 }),
    internalServerError: async () =>
      new Response("INTERNAL_SERVER_ERROR", { status: 500 }),
  }),
  session: new Session({
    sessionStorage: new MapSessionStorage<string>(),
    createValues: () => "",
    cookie: {},
  }),
};

await new HelloWorld({ app }).init();

app.router.listen(3000, () => {
  console.log("Listen on 3000");
});

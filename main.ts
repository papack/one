import { HelloWorld } from "./playground/hello-world.js";
import { Router } from "./router/router.js";
export type AppType = typeof app;

const app = {
  router: new Router({
    notFound: async () => new Response("NOT_FOUND", { status: 404 }),
    internalServerError: async () =>
      new Response("INTERNAL_SERVER_ERROR", { status: 500 }),
  }),
};

await new HelloWorld({ app }).init();

app.router.listen(3000, () => {
  console.log("Listen on 3000");
});

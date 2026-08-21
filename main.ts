import { Feat } from "./playground/feature.js";
import { Router } from "./Router.js";
export type AppType = typeof app;

const app = {
  router: new Router({
    notFound: async () => new Response("NOT_FOUND", { status: 400 }),
    internalServerError: async () =>
      new Response("INTERNAL_SERVER_ERROR", { status: 500 }),
  }),
};

await new Feat({ app }).init();

app.router.listen(3000, () => {
  console.log("Listen on 3000");
});

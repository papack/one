import { build } from "esbuild";
import { Feat } from "./playground/feature.js";
import { Router } from "./router/router.js";
export type AppType = typeof app;
import { readFile } from "node:fs/promises";
import { jsxTestPage } from "./playground/html.js";

const app = {
  router: new Router({
    notFound: async () => new Response("NOT_FOUND", { status: 404 }),
    internalServerError: async () =>
      new Response("INTERNAL_SERVER_ERROR", { status: 500 }),
  }),
};

//await new Feat({ app }).init();
jsxTestPage(app);

//try things:
const result = await build({
  entryPoints: ["./playground/script.ts"],
  minify: true,
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
  target: "es2022",
});
const PlaygroundClientRuntime = result.outputFiles[0].text;

app.router.add("GET", "/script.js", async () => {
  return new Response(PlaygroundClientRuntime, {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
    },
  });
});

const indexHtml = await readFile("./playground/index.html", "utf-8");
app.router.add("GET", "/", async () => {
  return new Response(indexHtml, {
    headers: { "content-type": "text/html; charset=utf8" },
  });
});

let counter = 0;
app.router.add("POST", "/inc", async () => {
  counter++;
  return new Response(`<span style="background-color: red">${counter}</span>`);
});

//Ende versuch

app.router.listen(3000, () => {
  console.log("Listen on 3000");
});

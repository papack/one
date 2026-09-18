import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { App } from "../../app";

export class StylesheetController {
  private constructor() {}

  public static async create(p: { app: App }) {
    const result = await build({
      entryPoints: [fileURLToPath(new URL("./style.css", import.meta.url))],
      bundle: true,
      minify: true,
      write: false,
    });
    const stylesheet = result.outputFiles.at(0)?.text;

    if (!stylesheet) {
      throw new Error("Stylesheet could not be built");
    }

    p.app.router.add("GET", "/style.css", async () => {
      return new Response(stylesheet, {
        headers: {
          "content-type": "text/css; charset=utf-8",
        },
      });
    });
  }
}

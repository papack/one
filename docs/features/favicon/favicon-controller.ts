import { readFile } from "node:fs/promises";
import { App } from "../../app";

export class FaviconController {
  private constructor() {}

  public static async create(p: { app: App }) {
    const favicon = await readFile(
      new URL("../../components/logo/logo.svg", import.meta.url),
      "utf8",
    );

    p.app.router.add("GET", "/favicon.svg", async () => {
      return new Response(favicon, {
        headers: {
          "cache-control": "public, max-age=604800",
          "content-type": "image/svg+xml",
        },
      });
    });
  }
}

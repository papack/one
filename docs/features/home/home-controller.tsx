import { html } from "@papack/one/html";
import { jsx } from "@papack/one/jsx";
import { HTML } from "@papack/one/headers";
import { App } from "../../app";
import { HomePage } from "./home-page";

export class HomeController {
  private constructor() {}
  public static async create(p: { app: App }) {
    p.app.router.add("GET", "/", async () => {
      return new Response(await html(<HomePage />), {
        headers: { "content-type": HTML },
      });
    });
  }
}

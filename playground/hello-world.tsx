import { jsx } from "../jsx";
import { html } from "../html";
import { AppType } from "../main";

export class HelloWorld {
  private app: AppType;

  constructor(p: { app: AppType }) {
    this.app = p.app;
  }

  public async init() {
    this.app.router.add("GET", "/", async (req) => {
      const sess = this.app.session.restore(req);
      sess.values;

      return new Response(await html(<div>Hello World!</div>), {
        headers: { "content-type": "text/html" },
      });
    });
  }
}

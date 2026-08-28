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
      const sess = await this.app.session.restore(req);
      sess.values;

      if (sess.isNew) {
        await this.app.session.save(sess);
      }

      return new Response(await html(<div>Hello World!</div>), {
        headers: {
          "content-type": "text/html",
          "set-cookie": sess.cookie,
        },
      });
    });
  }
}

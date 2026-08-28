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
      sess.values.count++;
      await sess.save();

      return new Response(
        await html(
          <div>
            Hello World! {sess.values.count} ({sess.id})
          </div>,
        ),
        {
          headers: {
            "content-type": "text/html",
            "set-cookie": sess.cookie,
          },
        },
      );
    });
  }
}

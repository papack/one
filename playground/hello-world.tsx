import { jsx, Repeat } from "../jsx";
import { html, Box, Stack } from "../html";
import { AppType } from "./main";
import { BaseTemplate } from "./base-template";
import { color, space } from "../style";

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
          <BaseTemplate title="Hello World!">
            <Stack g={space.md}>
              <Repeat n={3}>
                <Box b={`2px dashed ${color.red700}`} p={space.md}>
                  Hello World! {sess.values.count} ({sess.id})
                </Box>
              </Repeat>
            </Stack>
          </BaseTemplate>,
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

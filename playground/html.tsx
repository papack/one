import { jsx, fragment, Repeat } from "../jsx";
import { Box, html, Stack } from "../html";
import { AppType } from "../main";
import { space } from "../style";

export function jsxTestPage(app: AppType) {
  app.router.add("GET", "/jsx", async () => {
    return new Response(
      await html(
        <>
          <div>Hello</div>
          <Stack g={space.md}>
            <Repeat n={10}>
              <Box b="1px dashed hotpink" p="8px">
                inhalt der box
              </Box>
            </Repeat>
          </Stack>
          <div>
            <User />
          </div>
        </>,
      ),
      {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  });
}

async function User() {
  return <div>User</div>;
}

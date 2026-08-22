import { jsx, fragment } from "../jsx";
import { Box, html } from "../html";
import { AppType } from "../main";

export function jsxTestPage(app: AppType) {
  app.router.add("GET", "/jsx", async () => {
    return new Response(
      await html(
        <>
          <div>Hello</div>
          <Box b="1px dashed hotpink" p="8px">
            inhalt der box
          </Box>
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

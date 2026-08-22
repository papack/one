import { jsx, fragment } from "../jsx";
import { html } from "../html";
import { AppType } from "../main";

export function jsxTestPage(app: AppType) {
  app.router.add("GET", "/jsx", async () => {
    return new Response(
      await html(
        <>
          <div>Hello</div>
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

function User() {
  return <div>User</div>;
}

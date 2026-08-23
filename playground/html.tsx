import { For, jsx, fragment, Repeat, Show } from "../jsx";
import { Box, html, Stack } from "../html";
import { AppType } from "../main";
import { space } from "../style";

export function jsxTestPage(app: AppType) {
  app.router.add("GET", "/jsx", async () => {
    return new Response(
      await html(
        <>
          <h1>JSX-Komponenten</h1>
          <Stack g={space.md}>
            <section>
              <h2>For</h2>
              <ul>
                <For each={["Ada", "Linus", "Mina"]}>
                  {(name: string) => <li>{name}</li>}
                </For>
              </ul>
            </section>
            <section>
              <h2>Repeat</h2>
              <Repeat n={3}>
                <Box b="1px dashed hotpink" p="8px">
                  Wiederholte Box
                </Box>
              </Repeat>
            </section>
            <section>
              <h2>Show</h2>
              <Show when={true}>
                <p>Sichtbarer Inhalt</p>
              </Show>
              <Show when={false}>
                <p>Dieser Inhalt darf nicht erscheinen.</p>
              </Show>
            </section>
            <section>
              <h2>Leere Eingaben</h2>
              <For each={[]}>{(name: string) => <li>{name}</li>}</For>
              <Repeat n={0}>
                <p>Dieser Inhalt darf nicht erscheinen.</p>
              </Repeat>
            </section>
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

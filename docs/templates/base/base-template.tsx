import { jsx, JSXElement } from "@papack/one/jsx";

interface BaseTemplatePropsInterface {
  title: string;
  children: JSXElement;
}
export function BaseTemplate(p: BaseTemplatePropsInterface) {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>{`* {padding:0; margin:0;box-sizing:borderbox;}`}</style>
        <title>@papack/one - {p.title}</title>
      </head>
      <body>{p.children}</body>
    </html>
  );
}

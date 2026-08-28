import { JSXElement, jsx } from "../jsx";

interface BaseTemplatePropsInterface {
  title: string;
  children: JSXElement;
}
export function BaseTemplate(p: BaseTemplatePropsInterface) {
  return (
    <html lang="de">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{p.title}</title>
      </head>
      <body>{p.children}</body>
    </html>
  );
}

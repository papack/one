- JSX renderer for HTML.
- Use `class` for CSS classes: `<div class="card" />`.
- Write inline styles directly: `<div style="color:red" />`.
- Or use `css()` for a style object: `<div style={css({ color: "red" })} />`.
- `css()` converts camelCase properties to kebab-case and returns an inline CSS string.
- `true` renders a boolean attribute; `false`, `null`, and `undefined` are omitted.

## Plain text from HTML

`htmlToText(markup)` synchronously converts an HTML string to readable plain text.
It has no dependencies and works without a browser DOM. Render JSX once, then
derive both MIME alternatives from that result; components and database queries
are not executed a second time:

```tsx
import { html, htmlToText } from "@papack/one/html";

const markup = await html(<WelcomeMail userId={userId} />);
await smtp.send({
  to: ["user@example.com"],
  subject: "Welcome",
  html: markup,
  text: htmlToText(markup),
});
```

Paragraphs and headings become separate blocks, `<br>` becomes a line break,
lists get markers, table cells use tabs, and images contribute their `alt` text.
Links include their destinations unless the label already equals the destination.
Comments, head content, scripts, styles, templates, noscript, `hidden` elements
and inline `display:none` / `visibility:hidden` content are omitted.

This is a lightweight converter for generated HTML, not a browser layout engine
or an HTML sanitizer. Whitespace is normalized (including inside `<pre>`); CSS
stylesheets and classes are not evaluated. Numeric character references and
common named entities (including German/Western European characters) with
semicolons are decoded; unsupported named entities are preserved. Malformed HTML
is handled on a best-effort basis, without full browser error recovery.

Run `npm test` to run the Vitest tests, including the converter and JSX tests.

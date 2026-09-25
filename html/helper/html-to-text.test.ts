import { assert, test } from "vitest";
import { html, htmlToText } from "../index";
import { jsx } from "../../jsx/jsx";

test("paragraphs, headings, line breaks and inline whitespace", () => {
  assert.equal(
    htmlToText(
      "<h1>Willkommen</h1><p>Hallo <strong>Matthias</strong>!<br>Schön, dass du da bist.</p><p>Bis bald.</p>",
    ),
    "Willkommen\n\nHallo Matthias!\nSchön, dass du da bist.\n\nBis bald.",
  );
  assert.equal(
    htmlToText("\n <div> Hello\n  <em>world</em>! </div>\n"),
    "Hello world!",
  );
  assert.equal(htmlToText("a<span>b</span>c"), "abc");
  assert.equal(htmlToText("<p>one</p><hr><p>two</p>"), "one\n\ntwo");
});

test("links preserve destinations without duplicating their visible URL", () => {
  assert.equal(
    htmlToText('<a href="https://example.com?a=1&amp;b=2">Open</a>'),
    "Open (https://example.com?a=1&b=2)",
  );
  assert.equal(
    htmlToText('<a href="https://example.com">https://example.com</a>'),
    "https://example.com",
  );
  assert.equal(
    htmlToText('<a href="mailto:hello@example.com">Email</a>'),
    "Email (hello@example.com)",
  );
  assert.equal(htmlToText('<a href="tel:+49123">+49123</a>'), "+49123");
  assert.equal(htmlToText('<a href="/account"></a>'), "/account");
  assert.equal(htmlToText('<a href="#top">Top</a>'), "Top");
  assert.equal(htmlToText('<a href="javascript:alert(1)">Label</a>'), "Label");
});

test("ordered, unordered and nested lists", () => {
  assert.equal(
    htmlToText("<ul><li>One</li><li><b>Two</b></li></ul>"),
    "- One\n- Two",
  );
  assert.equal(
    htmlToText(
      '<ol start="3"><li>Three</li><li value="7">Seven</li><li>Eight</li></ol>',
    ),
    "3. Three\n7. Seven\n8. Eight",
  );
  assert.equal(htmlToText('<ol start="0"><li>Zero</li></ol>'), "0. Zero");
  assert.equal(
    htmlToText("<ul><li>Parent<ul><li>Child</li></ul></li><li>Next</li></ul>"),
    "- Parent\n\n- Child\n- Next",
  );
});

test("table rows and cells stay separated; image alt text is retained", () => {
  assert.equal(
    htmlToText(
      "<table><tr><th>Name</th><th>Count</th></tr><tr><td>Ada</td><td>2</td></tr></table>",
    ),
    "Name\tCount\nAda\t2",
  );
  assert.equal(
    htmlToText(
      '<p><img src="logo.png" alt="My &amp; App"> welcomes you<img src="spacer.png"></p>',
    ),
    "My & App welcomes you",
  );
});

test("comments, head, scripts, styles, templates and hidden elements are omitted", () => {
  const source = `<!doctype html><html><head><title>Private title</title><style>p {color:red}</style></head><body>
    <p>Visible</p><!-- comment <p>ignored</p> -->
    <script>if (a < b) { document.write('<p>ignored</p>'); }</script>
    <template><p>Template</p></template><noscript>Fallback</noscript>
    <div hidden><span>Hidden</span></div>
    <div style="color:red; display: none !important;"><b>Hidden</b></div>
    <div style='visibility:hidden'>Hidden</div><p>End</p></body></html>`;
  assert.equal(htmlToText(source), "Visible\n\nEnd");
  assert.equal(
    htmlToText("<div hidden><div>Nested</div>Hidden</div>Visible"),
    "Visible",
  );
  assert.equal(htmlToText("<script>unclosed <b>script"), "");
});

test("named and numeric entities are decoded once, encoded markup remains text", () => {
  assert.equal(
    htmlToText(
      "&lt;b&gt; &amp; &quot; &apos; &nbsp; &copy; &euro; &auml; &szlig; &#65; &#x1F30D;",
    ),
    "<b> & \" ' © € ä ß A 🌍",
  );
  assert.equal(htmlToText("&amp;lt;p&amp;gt;"), "&lt;p&gt;");
  assert.equal(htmlToText("&#0; &#xD800; &#x110000;"), "� � �");
  assert.equal(
    htmlToText("&unknown; &constructor; &toString;"),
    "&unknown; &constructor; &toString;",
  );
});

test("quoted tag attributes, uppercase HTML and raw text elements", () => {
  assert.equal(
    htmlToText(`<P title="a > b" data-other='c > d'>Hello<BR/>World</P>`),
    "Hello\nWorld",
  );
  assert.equal(
    htmlToText('<A HREF="/test?q=a&gt;b">Go</A>'),
    "Go (/test?q=a>b)",
  );
  assert.equal(
    htmlToText("<textarea>&lt;b&gt; &amp; <em>literal</em></textarea>"),
    "<b> & <em>literal</em>",
  );
  assert.equal(htmlToText("1 < 2 and 3 > 2"), "1 < 2 and 3 > 2");
});

test("empty input and common incomplete fragments", () => {
  assert.equal(htmlToText(""), "");
  assert.equal(htmlToText(" <br> \n"), "");
  assert.equal(htmlToText("<p>One<p>Two"), "One\n\nTwo");
  assert.equal(htmlToText("<ul><li>One<li>Two</ul>"), "- One\n- Two");
  assert.equal(htmlToText("<div>Hello <b>world"), "Hello world");
  assert.equal(htmlToText("Hello<!-- unfinished"), "Hello");
});

test("converting rendered HTML does not run async JSX components a second time", async () => {
  let queries = 0;
  async function Welcome() {
    queries++;
    const name = await Promise.resolve("Matthias & friends");
    return jsx("p", null, "Hello ", jsx("strong", null, name), "!");
  }
  const markup = await html(jsx(Welcome, null));
  assert.equal(htmlToText(markup), "Hello Matthias & friends!");
  assert.equal(queries, 1);
});

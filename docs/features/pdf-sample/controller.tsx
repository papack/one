import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { jsx } from "@papack/one/jsx";
import { pdf } from "@papack/one/pdf";
import {
  Absolute,
  Box,
  Center,
  Fixed,
  FlexItem,
  Grid,
  GridItem,
  Relative,
  Stack,
  Text,
} from "@papack/one/layout";
import { App } from "../../app";
import { Tiger } from "./tiger";
import { font, space } from "../../../dist/style/index.mjs";

const assets = new URL("./", import.meta.url);
const roboto = new Uint8Array(await readFile(new URL("Roboto.ttf", assets)));
const sampleImageBuffer = await readFile(new URL("sample-image.jpg", assets));
const sampleImagePath = fileURLToPath(new URL("sample-image.jpg", assets));
const sampleImageDataUrl = `data:image/jpeg;base64,${sampleImageBuffer.toString("base64")}`;
const sampleImageUrl =
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3d/Landscape_.jpg/330px-Landscape_.jpg";
const sampleTimestamp = new Date().toISOString();

export class PdfSampleController {
  private constructor() {}
  public static async create(p: { app: App }) {
    p.app.router.add("GET", "/sample.pdf", async () => {
      return new Response(samplePdf(), {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": 'inline; filename="sample.pdf"',
        },
      });
    });
  }
}

function PageHeader() {
  return (
    <div
      style={{
        position: "fixed",
        left: 30,
        right: 30,
        top: 14,
        height: 22,
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
      }}
    >
      <p style={{ width: 140, fontSize: 10, fontWeight: "bold" }}>
        NORTHWIND STUDIO
      </p>
      <p style={{ width: 110, fontSize: 10, color: "#667085" }}>
        Quarterly report
      </p>
    </div>
  );
}

function PageFooter() {
  return (
    <div
      style={{
        position: "fixed",
        left: 30,
        right: 30,
        bottom: 14,
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", flexDirection: "row", gap: 12 }}>
        <p style={{ fontSize: 9, color: "#667085" }}>Confidential</p>
        <p style={{ fontSize: 9, color: "#667085" }}>{sampleTimestamp}</p>
      </div>
      <div style={{ display: "flex", flexDirection: "row", gap: 3 }}>
        <page-number style={{ fontSize: 9, color: "#667085" }} />
        <p style={{ fontSize: 9, color: "#667085" }}>of</p>
        <pages-total style={{ fontSize: 9, color: "#667085" }} />
      </div>
    </div>
  );
}

function samplePdf(): ReadableStream<Uint8Array> {
  return pdf(
    <document
      title="Quarterly report"
      author="Northwind Studio"
      subject="Quarterly performance and product update"
      keywords={["quarterly report", "performance", "product"]}
      creator="Northwind Reporting"
      language="en-US"
      style={{ fontFamily: "Roboto" }}
    >
      <page size="A4" orientation="portrait" style={{ padding: 30 }}>
        <PageHeader />
        <PageFooter />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            backgroundColor: "#f2f4f7",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              border: "2pt solid red",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 18,
              backgroundColor: "white",
            }}
          >
            <p style={{ fontSize: 24, fontWeight: "bold" }}>Quarterly report</p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                border: "2pt solid red",
              }}
            >
              <p style={{ fontSize: 11, color: "#667085" }}>Prepared for</p>
              <p style={{ fontSize: 14 }}>Northwind Studio</p>
            </div>
          </div>

          <div
            style={{ display: "flex", flexDirection: "row", gap: 16, flex: 1 }}
          >
            <div
              style={{
                width: 150,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                backgroundColor: "#1d2939",
                color: "white",
              }}
            >
              <p style={{ fontSize: 16, fontWeight: "bold", color: "white" }}>
                Summary
              </p>
              <div
                style={{
                  position: "relative",
                  left: 4,
                  top: 3,
                  width: 112,
                  height: 42,
                  padding: 4,
                  backgroundColor: "#344054",
                }}
              >
                <p style={{ fontSize: 9, color: "white" }}>Relative box</p>
                <div
                  style={{
                    position: "absolute",
                    top: -7,
                    right: -6,
                    width: 32,
                    height: 18,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#f04438",
                  }}
                >
                  <p style={{ fontSize: 8, color: "white" }}>ABS</p>
                </div>
              </div>
              <p style={{ color: "#ff0000" }}>
                Сегодня хороший день для новых идей. Утром город был тихим, а
                воздух — свежим и прохладным. Я решил немного прогуляться,
                выпить кофе и подумать о новых проектах. Иногда самые простые
                моменты помогают лучше сосредоточиться и
              </p>
              <p style={{ fontSize: 11, color: "#d0d5dd" }}>
                Revenue grew steadily across the quarter, with the strongest
                performance in the final month.
              </p>
              <p style={{ fontSize: 11, color: "#d0d5dd" }}>
                The team stayed within budget while completing the planned work.
              </p>
            </div>

            <div
              style={{
                flex: 1,
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 14,
                backgroundColor: "white",
              }}
            >
              <p style={{ fontSize: 18, fontWeight: "bold" }}>Performance</p>
              <p style={{ fontSize: 12, lineHeight: 18, color: "#475467" }}>
                Customer demand increased through the quarter. The product team
                focused on reliability and onboarding, while operations reduced
                turnaround time for new accounts.
              </p>
              <div style={{ display: "flex", flexDirection: "row", gap: 12 }}>
                <div
                  style={{ flex: 1, padding: 14, backgroundColor: "#eff8ff" }}
                >
                  <p style={{ fontSize: 10, color: "#175cd3" }}>REVENUE</p>
                  <p style={{ fontSize: 20, fontWeight: "bold" }}>$248k</p>
                </div>
                <div
                  style={{ flex: 1, padding: 14, backgroundColor: "#ecfdf3" }}
                >
                  <p style={{ fontSize: 10, color: "#027a48" }}>NEW CLIENTS</p>
                  <p style={{ fontSize: 20, fontWeight: "bold" }}>184</p>
                </div>
                <div
                  style={{ flex: 1, padding: 14, backgroundColor: "#fffaeb" }}
                >
                  <p style={{ fontSize: 10, color: "#b54708" }}>RETENTION</p>
                  <p style={{ fontSize: 20, fontWeight: "bold" }}>96%</p>
                </div>
              </div>
              <p style={{ fontSize: 12, lineHeight: 18, color: "#475467" }}>
                Next quarter, the focus will be on expanding self-service tools
                and improving the quality of insights available to customers.
              </p>
              {Array.from({ length: 12 }, (_, index) => (
                <p
                  key={index}
                  style={{ fontSize: 11, lineHeight: 16, color: "#475467" }}
                >
                  Project update {index + 1}: the team completed the planned
                  milestones, reviewed customer feedback, and documented the
                  next set of improvements for the upcoming release.
                </p>
              ))}
            </div>
          </div>
        </div>
      </page>
      <page size="A4" style={{ padding: 30 }}>
        <PageHeader />
        <PageFooter />
        <p style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
          Images
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              flex: 1,
              padding: 10,
              backgroundColor: "white",
              border: "0.5pt solid #d0d5dd",
            }}
          >
            <p style={{ fontSize: 12, fontWeight: "bold", marginBottom: 8 }}>
              Remote URL
            </p>
            <img src={sampleImageUrl} style={{ width: 220 }} />
          </div>
          <div
            style={{
              flex: 1,
              padding: 10,
              backgroundColor: "white",
              border: "0.5pt solid #d0d5dd",
            }}
          >
            <p style={{ fontSize: 12, fontWeight: "bold", marginBottom: 8 }}>
              Buffer
            </p>
            <img src={sampleImageBuffer} style={{ width: 220 }} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "row", gap: 12 }}>
          <div
            style={{
              flex: 1,
              padding: 10,
              backgroundColor: "white",
              border: "0.5pt solid #d0d5dd",
            }}
          >
            <p style={{ fontSize: 12, fontWeight: "bold", marginBottom: 8 }}>
              File path
            </p>
            <img src={sampleImagePath} style={{ width: 220 }} />
          </div>
          <div
            style={{
              flex: 1,
              padding: 10,
              backgroundColor: "white",
              border: "0.5pt solid #d0d5dd",
            }}
          >
            <p style={{ fontSize: 12, fontWeight: "bold", marginBottom: 8 }}>
              Encoded data URL
            </p>
            <img src={sampleImageDataUrl} style={{ width: 220 }} />
          </div>
        </div>
        <p style={{ fontSize: 8, color: "#667085", marginTop: 12 }}>
          Photo by Mariia Zykova, CC BY-SA 4.0, Wikimedia Commons.
        </p>
      </page>
      <page size="A4" style={{ padding: 30 }}>
        <PageHeader />
        <PageFooter />
        <p style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
          Project status
        </p>
        <table columns={[75, 125, 335]}>
          <tr>
            <th>Period</th>
            <th>Initiative</th>
            <th>Update</th>
          </tr>
          {Array.from({ length: 28 }, (_, index) => (
            <tr key={index}>
              <td>Q{(index % 4) + 1} 2026</td>
              <td>
                {
                  ["Onboarding", "Reliability", "Self-service", "Analytics"][
                    index % 4
                  ]
                }
              </td>
              <td>
                The team completed the planned milestones, reviewed customer
                feedback, and documented the next improvements.
              </td>
            </tr>
          ))}
        </table>
      </page>
      <page size="A4" style={{ padding: 40 }}>
        <PageHeader />
        <PageFooter />
        <p style={{ fontSize: 24, fontWeight: "bold", marginBottom: 10 }}>
          Merged table cells
        </p>
        <p style={{ fontSize: 11, color: "#475467", marginBottom: 16 }}>
          Vertical writing in the first column, plus rowSpan and colSpan
          examples.
        </p>
        <table columns={[42, 128, 170, 170]}>
          <tr>
            <th
              rowSpan={2}
              style={{
                writingMode: "vertical-rl",
                textAlign: "center",
                backgroundColor: "#dbeafe",
              }}
            >
              SPRINT
            </th>
            <th>Project</th>
            <th colSpan={2}>Delivery</th>
          </tr>
          <tr>
            <th>Activity</th>
            <th>Owner</th>
            <th>Due</th>
          </tr>
          <tr>
            <td
              rowSpan={2}
              style={{ fontWeight: "bold", backgroundColor: "#f2f4f7" }}
            >
              Sprint 01
            </td>
            <td>Design system</td>
            <td>Alex</td>
            <td>June 12</td>
          </tr>
          <tr>
            <td>Components</td>
            <td>Sam</td>
            <td>June 16</td>
          </tr>
          <tr>
            <td>Sprint 02</td>
            <td>Accessibility review</td>
            <td>Jordan</td>
            <td>June 24</td>
          </tr>
        </table>
      </page>
      <page
        size="A4"
        orientation="landscape"
        style={{ padding: 48, backgroundColor: "#f9fafb" }}
      >
        <PageHeader />
        <PageFooter />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontSize: 28, fontWeight: "bold" }}>Appendix</p>
          <p style={{ fontSize: 13, lineHeight: 20, color: "#475467" }}>
            This is a separately authored page following the quarterly report.
          </p>
        </div>
      </page>
      <page size="A4" style={{ padding: 40 }}>
        <PageHeader />
        <PageFooter />
        <p style={{ fontSize: 24, fontWeight: "bold", marginBottom: 10 }}>
          Grid layout
        </p>
        <p style={{ fontSize: 11, color: "#475467", marginBottom: 18 }}>
          Three equal columns with automatic rows and consistent gaps.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
          }}
        >
          {[
            ["01", "Research", "Customer interviews and market review."],
            ["02", "Design", "Prototype, visual system, and content."],
            ["03", "Build", "Implementation and accessibility."],
            ["04", "Review", "Quality checks and feedback."],
            ["05", "Launch", "Release planning and rollout."],
            ["06", "Improve", "Measure results and iterate."],
          ].map(([number, title, description]) => (
            <div
              key={number}
              style={{
                padding: 14,
                backgroundColor: "#f2f4f7",
                border: "1pt solid #d0d5dd",
              }}
            >
              <p style={{ fontSize: 10, color: "#175cd3", marginBottom: 6 }}>
                {number}
              </p>
              <p style={{ fontSize: 14, fontWeight: "bold", marginBottom: 5 }}>
                {title}
              </p>
              <p style={{ fontSize: 10, lineHeight: 14, color: "#475467" }}>
                {description}
              </p>
            </div>
          ))}
        </div>
      </page>
      <page size="A4" style={{ padding: 40 }}>
        <PageHeader />
        <PageFooter />
        <p style={{ fontSize: 24, fontWeight: "bold", marginBottom: 12 }}>
          SVG vectors
        </p>
        <p style={{ fontSize: 11, color: "#475467", marginBottom: 18 }}>
          Inline SVG elements render as vector paths in the PDF: paths, shapes,
          groups, fills, strokes and transforms.
        </p>
        <svg
          width="480"
          height="290"
          viewBox="0 0 480 290"
          style={{ border: "1pt solid #d0d5dd" }}
        >
          <rect x="0" y="0" width="480" height="290" fill="#f8fafc" />
          <g transform="translate(24 22)">
            <rect
              x="0"
              y="0"
              width="200"
              height="100"
              rx="12"
              fill="#dbeafe"
              stroke="#2563eb"
              strokeWidth="3"
            />
            <circle
              cx="56"
              cy="50"
              r="27"
              fill="#60a5fa"
              stroke="#1d4ed8"
              strokeWidth="2"
            />
            <ellipse
              cx="139"
              cy="50"
              rx="38"
              ry="23"
              fill="#bfdbfe"
              stroke="#1d4ed8"
              strokeWidth="2"
            />
            <path
              d="M 12 140 C 55 100 96 190 140 140 S 205 105 220 145"
              fill="none"
              stroke="#7c3aed"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <path
              d="M250 0 L300 25 L285 80 L230 65 Z"
              fill="#fda4af"
              stroke="#be123c"
              strokeWidth="3"
            />
            <line
              x1="250"
              y1="110"
              x2="365"
              y2="110"
              stroke="#111827"
              strokeWidth="3"
              strokeDasharray="8 5"
            />
            <polyline
              points="250,145 280,125 310,150 340,122 370,145"
              fill="none"
              stroke="#059669"
              strokeWidth="4"
              strokeLinejoin="round"
            />
            <polygon
              points="250,180 275,165 300,180 290,210 260,210"
              fill="#a7f3d0"
              stroke="#047857"
              strokeWidth="2"
            />
            <text x="0" y="245" fill="#344054" fontSize="16">
              PDF vector SVG
            </text>
          </g>
        </svg>
      </page>
      <page size="A4" style={{ padding: 40 }}>
        <PageHeader />
        <PageFooter />
        <p style={{ fontSize: 24, fontWeight: "bold", marginBottom: 12 }}>
          Tiger illustration
        </p>
        <p style={{ fontSize: 11, color: "#475467", marginBottom: 18 }}>
          A small vector tiger drawn directly as JSX SVG elements.
        </p>
        <Box
          p="12pt"
          b="1pt solid #d0d5dd"
          r="8pt"
          bg="#fff7ed"
          style={{ width: "100%" }}
        >
          <Center>
            <Tiger />
          </Center>
        </Box>
        <p style={{ fontSize: 15, marginTop: 8 }}>
          Text with{" "}
          <span style={{ fontWeight: "bold", color: "#b42318" }}>bold red</span>
          ,{" "}
          <span style={{ fontStyle: "italic", color: "#175cd3" }}>
            italic blue
          </span>
          , and regular inline text.
        </p>
        <ul style={{ fontSize: 11, marginTop: 8 }}>
          <li>Unordered item with a bullet</li>
          <li>
            Another item with{" "}
            <span style={{ fontWeight: "bold" }}>bold text</span>
          </li>
        </ul>
        <ol style={{ fontSize: 11, marginTop: 6 }}>
          <li>First ordered step</li>
          <li>Second ordered step</li>
          <li>Third ordered step</li>
        </ol>
      </page>
      <page size="A4" style={{ padding: 40 }}>
        <PageHeader />
        <PageFooter />
        <p style={{ fontSize: 24, fontWeight: "bold", marginBottom: 12 }}>
          Layout components
        </p>
        <p style={{ fontSize: 11, color: "#475467", marginBottom: 18 }}>
          Box, Center, Stack, Grid, FlexItem, GridItem, Relative, Absolute, and
          Fixed are imported from the regular layout package.
        </p>
        <Stack g="12pt">
          <Box p="12pt" bg="#eff8ff" b="1pt solid #84caff" r="8pt">
            <p style={{ fontWeight: "bold" }}>Box</p>
            <p>Padding, background, border, and radius.</p>
          </Box>
          <Center p="16pt" bg="#ecfdf3" b="1pt solid #75e0a7" r="8pt">
            <p>Centered content</p>
          </Center>
          <Stack
            g={space["3xl"]}
            p="12pt"
            bg="#fffaeb"
            b="1pt solid #fec84b"
            r="8pt"
          >
            <p style={{ fontWeight: "bold" }}>Nested Stack</p>
            <p>Children arranged vertically with a gap.</p>
          </Stack>
        </Stack>
      </page>
      <page size="A4" style={{ padding: 40 }}>
        <PageHeader />
        <PageFooter />
        <p style={{ fontSize: 24, fontWeight: "bold", marginBottom: 12 }}>
          Grid and item components
        </p>
        <Grid grdTemplateColumns="1fr 1fr" g="12pt">
          <GridItem p="12pt" bg="#eff8ff" b="1pt solid #84caff" r="8pt">
            <p style={{ fontWeight: "bold" }}>GridItem</p>
            <p>First grid cell.</p>
          </GridItem>
          <GridItem
            grdColumn="span 1"
            p="12pt"
            bg="#ecfdf3"
            b="1pt solid #75e0a7"
            r="8pt"
          >
            <p style={{ fontWeight: "bold" }}>Second cell</p>
            <p>Placed by the PDF grid layout.</p>
          </GridItem>
          <Stack g="8pt">
            <FlexItem flxGrow="1" p="12pt" bg="#fffaeb" r="8pt">
              <p style={{ fontWeight: "bold" }}>FlexItem</p>
              <p>Flex sizing inside a Stack.</p>
            </FlexItem>
          </Stack>
        </Grid>
      </page>
      <page size="A4" style={{ padding: 40 }}>
        <PageHeader />
        <PageFooter />
        <p style={{ fontSize: 24, fontWeight: "bold", marginBottom: 12 }}>
          Relative and absolute positioning
        </p>
        <Relative
          p="12pt"
          bg="#eff8ff"
          b="1pt solid #84caff"
          style={{ width: "150pt", height: "110pt" }}
        >
          <p>Relative parent</p>
          <Absolute
            top="-12pt"
            right="-12pt"
            p="8pt"
            bg="#fef3f2"
            b="1pt solid #fda29b"
          >
            <p>Absolute</p>
          </Absolute>
        </Relative>
      </page>
      <page size="A4" style={{ padding: 40 }}>
        <PageHeader />
        <PageFooter />
        <p style={{ fontSize: 24, fontWeight: "bold", marginBottom: 12 }}>
          Fixed positioning
        </p>
        <p>Fixed content repeats at the same page coordinates.</p>
        <Fixed
          right="40pt"
          bottom="55pt"
          p="8pt"
          bg="#f4f3ff"
          b="1pt solid #a4bcfd"
        >
          <p>Fixed footer badge</p>
        </Fixed>
      </page>
      <page size="A4" style={{ padding: 0 }}>
        <Center h="100vh" w="100vw" bg="#f2f4f7">
          <Box p="20pt" bg="#ffffff" b="2pt solid #175cd3" r="12pt">
            <Text fs={font.size["xs"]} fw="800">
              Centered on the page
            </Text>
            <p style={{ fontSize: 12 }}>Center h="100vh" w="100vw"</p>
          </Box>
        </Center>
      </page>
    </document>,
    { fonts: { Roboto: { 400: roboto } } },
  );
}

import fs from "fs";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  ShadingType,
} from "docx";

const md = fs.readFileSync("AUDITX_52_PAGE_PROJECT_REPORT.md", "utf8");
const lines = md.split("\n");

const docChildren = [];

// Header & Footer
const defaultHeader = new Header({
  children: [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({
          text: "AUDIT'X: DARK STORE OPERATIONS & LOGISTICS PLATFORM",
          size: 18, // 9pt
          color: "666666",
          font: "Times New Roman",
        }),
      ],
    }),
  ],
});

const defaultFooter = new Footer({
  children: [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "Page ",
          size: 20, // 10pt
          font: "Times New Roman",
        }),
        new TextRun({
          children: [PageNumber.CURRENT],
          size: 20,
          font: "Times New Roman",
        }),
        new TextRun({
          text: " of ",
          size: 20,
          font: "Times New Roman",
        }),
        new TextRun({
          children: [PageNumber.TOTAL_PAGES],
          size: 20,
          font: "Times New Roman",
        }),
      ],
    }),
  ],
});

let inCodeBlock = false;
let codeBuffer = [];
let inTable = false;
let tableRows = [];

function flushCodeBlock() {
  if (codeBuffer.length === 0) return;
  const fullCode = codeBuffer.join("\n");
  docChildren.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill: "F3F4F6" },
              margins: { top: 140, bottom: 140, left: 140, right: 140 },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
                left: { style: BorderStyle.SINGLE, size: 12, color: "3B82F6" },
                right: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: fullCode,
                      font: "Consolas",
                      size: 18, // 9pt
                      color: "1F2937",
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );
  docChildren.push(new Paragraph({ spacing: { after: 120 } }));
  codeBuffer = [];
}

function flushTable() {
  if (tableRows.length === 0) return;
  // Parse rows
  const parsedRows = tableRows
    .map((r) => r.trim())
    .filter((r) => r.startsWith("|") && r.endsWith("|") && !r.includes("---"))
    .map((r) =>
      r
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim())
    );

  if (parsedRows.length > 0) {
    const colCount = parsedRows[0].length;
    const docxRows = parsedRows.map((cols, rowIndex) => {
      return new TableRow({
        tableHeader: rowIndex === 0,
        children: cols.map((colText) => {
          return new TableCell({
            shading:
              rowIndex === 0
                ? { type: ShadingType.CLEAR, fill: "1E3A8A" }
                : rowIndex % 2 === 1
                ? { type: ShadingType.CLEAR, fill: "FFFFFF" }
                : { type: ShadingType.CLEAR, fill: "F9FAFB" },
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
              left: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
              right: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
            },
            children: [
              new Paragraph({
                alignment: rowIndex === 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
                children: [
                  new TextRun({
                    text: colText.replace(/\*\*/g, ""),
                    font: "Times New Roman",
                    size: 20, // 10pt
                    bold: rowIndex === 0 || colText.startsWith("**"),
                    color: rowIndex === 0 ? "FFFFFF" : "111827",
                  }),
                ],
              }),
            ],
          });
        }),
      });
    });

    docChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: docxRows,
      })
    );
    docChildren.push(new Paragraph({ spacing: { after: 140 } }));
  }
  tableRows = [];
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  if (line.startsWith("```")) {
    if (inCodeBlock) {
      inCodeBlock = false;
      flushCodeBlock();
    } else {
      if (inTable) {
        inTable = false;
        flushTable();
      }
      inCodeBlock = true;
    }
    continue;
  }

  if (inCodeBlock) {
    codeBuffer.push(line);
    continue;
  }

  if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
    inTable = true;
    tableRows.push(line);
    continue;
  } else if (inTable) {
    inTable = false;
    flushTable();
  }

  // Check screenshot placeholder
  if (line.includes("[SCREENSHOT PLACEHOLDER:")) {
    docChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { type: ShadingType.CLEAR, fill: "EFF6FF" },
                margins: { top: 200, bottom: 200, left: 200, right: 200 },
                borders: {
                  top: { style: BorderStyle.DASHED, size: 12, color: "2563EB" },
                  bottom: { style: BorderStyle.DASHED, size: 12, color: "2563EB" },
                  left: { style: BorderStyle.DASHED, size: 12, color: "2563EB" },
                  right: { style: BorderStyle.DASHED, size: 12, color: "2563EB" },
                },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: "📸 " + line.replace(/[\[\]]/g, "").trim(),
                        font: "Times New Roman",
                        size: 24, // 12pt
                        bold: true,
                        color: "1D4ED8",
                      }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 80 },
                    children: [
                      new TextRun({
                        text: "(Click this box in Word and press Ctrl+V to paste your screenshot here)",
                        font: "Times New Roman",
                        size: 18,
                        italics: true,
                        color: "64748B",
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
    docChildren.push(new Paragraph({ spacing: { after: 120 } }));
    continue;
  }

  // Heading 1
  if (line.startsWith("# ")) {
    docChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 280, after: 140 },
        children: [
          new TextRun({
            text: line.replace("# ", "").replace(/\*\*/g, ""),
            font: "Times New Roman",
            size: 32, // 16pt
            bold: true,
            color: "0F172A",
          }),
        ],
      })
    );
    continue;
  }

  // Heading 2
  if (line.startsWith("## ")) {
    docChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 220, after: 100 },
        children: [
          new TextRun({
            text: line.replace("## ", "").replace(/\*\*/g, ""),
            font: "Times New Roman",
            size: 28, // 14pt
            bold: true,
            color: "1E3A8A",
          }),
        ],
      })
    );
    continue;
  }

  // Heading 3
  if (line.startsWith("### ")) {
    docChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 180, after: 80 },
        children: [
          new TextRun({
            text: line.replace("### ", "").replace(/\*\*/g, ""),
            font: "Times New Roman",
            size: 24, // 12pt
            bold: true,
            color: "1E293B",
          }),
        ],
      })
    );
    continue;
  }

  // Page break
  if (line.includes("\\newpage") || line.trim() === "---") {
    docChildren.push(
      new Paragraph({
        pageBreakBefore: true,
        children: [],
      })
    );
    continue;
  }

  // Bullet items
  if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
    docChildren.push(
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 60, line: 360 }, // 1.5 line spacing
        children: [
          new TextRun({
            text: line.trim().slice(2).replace(/\*\*/g, ""),
            font: "Times New Roman",
            size: 24, // 12pt
            color: "1F2937",
          }),
        ],
      })
    );
    continue;
  }

  // Standard Paragraph
  if (line.trim().length > 0) {
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 120, line: 360 }, // 1.5 line spacing
        children: [
          new TextRun({
            text: line.trim().replace(/\*\*/g, ""),
            font: "Times New Roman",
            size: 24, // 12pt
            color: "1F2937",
          }),
        ],
      })
    );
  }
}

const doc = new Document({
  sections: [
    {
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }, // 1 inch margins
        },
      },
      headers: { default: defaultHeader },
      footers: { default: defaultFooter },
      children: docChildren,
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync("AUDITX_52_PAGE_PROJECT_REPORT.docx", buffer);
  console.log("SUCCESSFULLY GENERATED: AUDITX_52_PAGE_PROJECT_REPORT.docx (" + buffer.length + " bytes)");
});


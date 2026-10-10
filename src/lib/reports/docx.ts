import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  HeadingLevel,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { PersonalizedReportContent, ReportRequest } from './schema';

const INK = '071B2A';
const CYAN = '007E9D';
const MUTED = '526577';
const RULE = 'D9D5C9';
const PAPER = 'F8F6F0';

function safeName(title: string): string {
  const normalized = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
  return `${normalized || 'personalized-intelligence-report'}.docx`;
}

function bullet(text: string) {
  return new Paragraph({
    style: 'ReportBody',
    bullet: { level: 0 },
    spacing: { after: 100 },
    children: [new TextRun(text)],
  });
}

function heading1(text: string) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text, bold: true, color: INK, size: 36 })] });
}

function heading2(text: string) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text, bold: true, color: INK, size: 28 })] });
}

export async function createReportDocx(content: PersonalizedReportContent, request: ReportRequest): Promise<{ buffer: Buffer; fileName: string }> {
  const scopeRows = [
    ['Period', `${new Date(content.periodStart).toLocaleDateString('en-US')} – ${new Date(content.periodEnd).toLocaleDateString('en-US')}`],
    ['Geography', request.geographies.length ? request.geographies.join(', ') : 'Global'],
    ['Investors', request.fundIds.length ? `${request.fundIds.length} selected` : 'All qualifying'],
    ['YC Batches', request.ycBatchIds.length ? request.ycBatchIds.join(', ') : 'Latest'],
    ['Topics', request.topics.length ? request.topics.map(v => v.replaceAll('_', ' ')).join(', ') : 'All AI'],
    ['Target', `${request.requestedPages} pages (approx.)`],
  ];

  const children: Array<Paragraph | Table> = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: content.title, bold: true, color: INK, size: 48 })] }),
    new Paragraph({ children: [new TextRun({ text: content.subtitle, color: MUTED, size: 24 })] }),
    new Paragraph({ children: [new TextRun({ text: `Prepared ${new Date(content.generatedAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}`, color: MUTED, size: 18 })] }),
  ];

  if (request.audience) children.push(new Paragraph({ children: [new TextRun({ text: `Audience: ${request.audience}`, color: MUTED, size: 18 })] }));
  if (request.purpose) children.push(new Paragraph({ children: [new TextRun({ text: `Purpose: ${request.purpose}`, color: MUTED, size: 18 })] }));

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: { style: BorderStyle.SINGLE, color: RULE, size: 4 }, bottom: { style: BorderStyle.SINGLE, color: RULE, size: 4 }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.SINGLE, color: RULE, size: 2 }, insideVertical: { style: BorderStyle.NONE } },
      rows: scopeRows.map(([label, value]) => new TableRow({
        children: [
          new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, shading: { fill: PAPER }, children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, color: INK, size: 20 })] })] }),
          new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: value, color: MUTED, size: 20 })] })] }),
        ],
      })),
    }),
  );

  children.push(heading1('Executive Summary'));
  children.push(new Paragraph({ style: 'ReportBody', children: [new TextRun({ text: content.executiveSummary, size: 22, color: INK })] }));

  content.sections.forEach(item => {
    children.push(heading1(item.title));
    children.push(new Paragraph({ style: 'ReportBody', children: [new TextRun({ text: item.summary.text, size: 22, color: INK })] }));
    item.findings.forEach(finding => {
      children.push(bullet(finding.text));
    });
  });

  children.push(
    heading1('Methodology and Caveats'),
    new Paragraph({ style: 'ReportBody', children: [new TextRun({ text: content.methodology, size: 20 })] }),
    ...content.caveats.map(item => bullet(item)),
  );

  if (content.sources.length > 0) {
    children.push(
      heading1('Sources'),
    );
    content.sources.forEach(source => children.push(new Paragraph({
      style: 'ReportBody',
      spacing: { after: 100 },
      children: [
        new TextRun({ text: `${source.label}: `, bold: true, size: 20 }),
        new ExternalHyperlink({ link: source.url, children: [new TextRun({ text: source.url, color: CYAN, underline: {}, size: 20 })] }),
      ],
    })));
  }

  children.push(
    new Paragraph({ style: 'ReportBody', children: [new TextRun({ text: 'This is an evidence-grounded research brief. Verify primary sources before making consequential decisions. This is not investment, legal, or financial advice.', bold: true, size: 20 })] }),
  );

  const document = new Document({
    creator: 'Personalized Intelligence',
    title: content.title,
    description: 'Evidence-grounded personalized market intelligence report',
    styles: {
      default: { document: { run: { font: 'Aptos', size: 21, color: INK }, paragraph: { spacing: { line: 300, after: 120 } } } },
      paragraphStyles: [
        { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Subtitle', run: { font: 'Aptos Display', size: 56, bold: true, color: INK }, paragraph: { spacing: { before: 120, after: 180 } } },
        { id: 'Subtitle', name: 'Subtitle', basedOn: 'Normal', next: 'Normal', run: { font: 'Aptos', size: 26, color: MUTED }, paragraph: { spacing: { after: 260 } } },
        { id: 'ReportBody', name: 'Report Body', basedOn: 'Normal', run: { font: 'Aptos', size: 21, color: INK }, paragraph: { spacing: { after: 130, line: 300 } } },
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'ReportBody', quickFormat: true, run: { font: 'Aptos Display', size: 34, bold: true, color: INK }, paragraph: { spacing: { before: 320, after: 150 }, keepNext: true } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'ReportBody', quickFormat: true, run: { font: 'Aptos Display', size: 28, bold: true, color: INK }, paragraph: { spacing: { before: 240, after: 100 }, keepNext: true } },
      ],
    },
    sections: [{
      properties: { page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Confidential  •  ', color: MUTED, size: 16 }), new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: 16 })] })] }) },
      children,
    }],
  });

  const buffer = await Packer.toBuffer(document);
  return { buffer, fileName: `personalized-intelligence-report-${Date.now()}.docx` };
}
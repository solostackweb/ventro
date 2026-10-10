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
import { evidenceLabels } from './synthesis';

const INK = '071B2A';
const CYAN = '007E9D';
const MUTED = '526577';
const RULE = 'D9D5C9';
const PAPER = 'F8F6F0';

function safeName(title: string): string {
  const normalized = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
  return `${normalized || 'ventro-personalized-report'}.docx`;
}

function bullet(text: string) {
  return new Paragraph({
    style: 'ReportBody',
    bullet: { level: 0 },
    spacing: { after: 100 },
    children: [new TextRun(text)],
  });
}

function evidenceLine(sourceIds: string[], content: PersonalizedReportContent): Paragraph | null {
  const sources = evidenceLabels(sourceIds, content.sources);
  if (!sources.length) return null;
  const children: Array<TextRun | ExternalHyperlink> = [new TextRun({ text: 'Evidence: ', bold: true, color: MUTED, size: 17 })];
  sources.forEach((source, index) => {
    if (index > 0) children.push(new TextRun({ text: '  ·  ', color: MUTED, size: 17 }));
    children.push(new ExternalHyperlink({ link: source.url, children: [new TextRun({ text: source.label, color: CYAN, underline: {}, size: 17 })] }));
  });
  return new Paragraph({ style: 'Evidence', children });
}

export async function createReportDocx(content: PersonalizedReportContent, request: ReportRequest): Promise<{ buffer: Buffer; fileName: string }> {
  const scopeRows = [
    ['Evidence window', `${new Date(content.periodStart).toLocaleDateString('en-US')} – ${new Date(content.periodEnd).toLocaleDateString('en-US')}`],
    ['Geography', request.geographies.length ? request.geographies.join(', ') : 'Global'],
    ['Selected investors', request.fundIds.length ? `${request.fundIds.length} selected` : 'All qualifying investors'],
    ['YC batches', request.ycBatchIds.length ? request.ycBatchIds.join(', ') : 'Latest qualifying batches'],
    ['Topics', request.topics.length ? request.topics.map(value => value.replaceAll('_', ' ')).join(', ') : 'All AI topics'],
    ['Target length', `${request.requestedPages} pages (approximate)`],
  ];

  const children: Array<Paragraph | Table> = [
    new Paragraph({ style: 'Eyebrow', children: [new TextRun('VENTRO PERSONALIZED INTELLIGENCE')] }),
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(content.title)] }),
    new Paragraph({ style: 'Subtitle', children: [new TextRun(content.subtitle)] }),
    new Paragraph({ style: 'Meta', children: [new TextRun(`Prepared ${new Date(content.generatedAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}`)] }),
  ];

  if (request.audience) children.push(new Paragraph({ style: 'Meta', children: [new TextRun(`Audience: ${request.audience}`)] }));
  if (request.purpose) children.push(new Paragraph({ style: 'Meta', children: [new TextRun(`Purpose: ${request.purpose}`)] }));

  children.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun('Executive answer')] }),
    new Paragraph({ style: 'Lead', children: [new TextRun(content.executiveSummary)] }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, color: RULE, size: 4 },
        bottom: { style: BorderStyle.SINGLE, color: RULE, size: 4 },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.SINGLE, color: RULE, size: 2 },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: scopeRows.map(([label, value]) => new TableRow({
        children: [
          new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, shading: { fill: PAPER }, children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, color: INK })] })] }),
          new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: value, color: MUTED })] })] }),
        ],
      })),
    }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Reader note')] }),
    new Paragraph({ style: 'ReportBody', children: [new TextRun('This is a final evidence brief for the selected scope. Preserve the evidence links and factual qualifications if you adapt the voice, add organization-specific judgment, or circulate it externally.')] }),
  );

  content.sections.forEach(item => {
    const summaryEvidence = evidenceLine(item.summary.sourceIds, content);
    children.push(
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(item.title)] }),
      new Paragraph({ style: 'Lead', children: [new TextRun(item.summary.text)] }),
    );
    if (summaryEvidence) children.push(summaryEvidence);
    item.findings.forEach(finding => {
      children.push(bullet(finding.text));
      const evidence = evidenceLine(finding.sourceIds, content);
      if (evidence) children.push(evidence);
    });
  });

  children.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun('Methodology and caveats')] }),
    new Paragraph({ style: 'ReportBody', children: [new TextRun(content.methodology)] }),
    ...content.caveats.map(item => bullet(item)),
    new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun('Source register')] }),
  );

  if (!content.sources.length) {
    children.push(new Paragraph({ style: 'ReportBody', children: [new TextRun('No qualifying source links were available for this scope. Broaden the filters or wait for additional verified evidence before using the report externally.')] }));
  } else {
    content.sources.forEach(source => children.push(new Paragraph({
      style: 'ReportBody',
      spacing: { after: 100 },
      children: [
        new TextRun({ text: `${source.label}: `, bold: true }),
        new ExternalHyperlink({ link: source.url, children: [new TextRun({ text: source.url, color: CYAN, underline: {} })] }),
      ],
    })));
  }

  children.push(
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Final review reminder')] }),
    new Paragraph({ style: 'ReportBody', children: [new TextRun({ text: `Evidence verification: ${content.verification.status === 'verified' ? 'AI verifier plus deterministic citation contracts' : 'deterministic citation contracts'}. Verify primary sources before making consequential decisions. This is not investment, legal, or financial advice.`, bold: true })] }),
  );

  const document = new Document({
    creator: 'Ventro',
    title: content.title,
    description: 'Evidence-grounded personalized VC and YC intelligence report',
    styles: {
      default: { document: { run: { font: 'Aptos', size: 21, color: INK }, paragraph: { spacing: { line: 300, after: 120 } } } },
      paragraphStyles: [
        { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Subtitle', run: { font: 'Aptos Display', size: 56, bold: true, color: INK }, paragraph: { spacing: { before: 120, after: 180 } } },
        { id: 'Subtitle', name: 'Subtitle', basedOn: 'Normal', next: 'Normal', run: { font: 'Aptos', size: 26, color: MUTED }, paragraph: { spacing: { after: 260 } } },
        { id: 'Eyebrow', name: 'Eyebrow', basedOn: 'Normal', run: { font: 'Aptos', size: 18, bold: true, color: CYAN, characterSpacing: 40 }, paragraph: { spacing: { before: 500, after: 120 } } },
        { id: 'Meta', name: 'Meta', basedOn: 'Normal', run: { font: 'Aptos', size: 18, color: MUTED }, paragraph: { spacing: { after: 70 } } },
        { id: 'Lead', name: 'Lead', basedOn: 'Normal', run: { font: 'Aptos', size: 25, color: INK }, paragraph: { spacing: { after: 220, line: 330 } } },
        { id: 'ReportBody', name: 'Report Body', basedOn: 'Normal', run: { font: 'Aptos', size: 21, color: INK }, paragraph: { spacing: { after: 130, line: 300 } } },
        { id: 'Evidence', name: 'Evidence', basedOn: 'Normal', run: { font: 'Aptos', size: 17, color: MUTED }, paragraph: { spacing: { after: 130 }, indent: { left: 360 }, keepNext: false } },
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'ReportBody', quickFormat: true, run: { font: 'Aptos Display', size: 34, bold: true, color: INK }, paragraph: { spacing: { before: 320, after: 150 }, keepNext: true } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'ReportBody', quickFormat: true, run: { font: 'Aptos Display', size: 26, bold: true, color: INK }, paragraph: { spacing: { before: 240, after: 100 }, keepNext: true } },
      ],
    },
    sections: [{
      properties: { page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'VENTRO  •  ', color: MUTED, size: 16 }), new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: 16 })] })] }) },
      children,
    }],
  });

  const buffer = await Packer.toBuffer(document);
  return { buffer, fileName: safeName(content.title) };
}

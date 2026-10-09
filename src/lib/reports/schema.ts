import { z } from 'zod';

export const REPORT_SECTION_OPTIONS = [
  'executive_summary',
  'capital_flow',
  'investor_theses',
  'yc_signals',
  'market_patterns',
  'selected_investors',
  'implications',
  'sources',
] as const;

export const reportRequestSchema = z.object({
  title: z.string().trim().min(3).max(140),
  requestedPages: z.number().int().min(3).max(15),
  periodDays: z.union([z.literal(30), z.literal(90), z.literal(180), z.literal(365)]),
  geographies: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  fundIds: z.array(z.string().uuid()).max(20).default([]),
  ycBatchIds: z.array(z.string().trim().min(1).max(20)).max(12).default([]),
  topics: z.array(z.string().trim().min(1).max(80)).max(16).default([]),
  includedSections: z.array(z.enum(REPORT_SECTION_OPTIONS)).min(3).max(REPORT_SECTION_OPTIONS.length),
  audience: z.string().trim().max(240).optional().default(''),
  purpose: z.string().trim().max(500).optional().default(''),
}).superRefine((value, ctx) => {
  for (const required of ['executive_summary', 'sources'] as const) {
    if (!value.includedSections.includes(required)) ctx.addIssue({ code: 'custom', path: ['includedSections'], message: `${required} is required` });
  }
});

export type ReportRequest = z.infer<typeof reportRequestSchema>;

export interface ReportSource {
  label: string;
  url: string;
  sourceType: 'funding' | 'thesis' | 'pattern' | 'fund' | 'yc';
}

export interface ReportSectionContent {
  key: string;
  title: string;
  summary: string;
  bullets: string[];
  sourceIndexes: number[];
}

export interface PersonalizedReportContent {
  title: string;
  subtitle: string;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  methodology: string;
  executiveSummary: string;
  sections: ReportSectionContent[];
  caveats: string[];
  sources: ReportSource[];
}

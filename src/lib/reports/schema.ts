import { z } from 'zod';

export const REPORT_SECTION_OPTIONS = [
  'executive_summary',
  'capital_flow',
  'investor_theses',
  'yc_leadership',
  'yc_startups',
  'global_vs_india',
  'personal_direction',
  'yc_signals',
  'market_patterns',
  'selected_investors',
  'implications',
  'sources',
  'evidence_trail',
  'investment_detail',
  'thesis_detail',
  'pattern_detail',
] as const;

const personalizationSchema = z.object({
  includeEvidenceTrail: z.boolean().default(false),
  includeInvestmentTables: z.boolean().default(true),
  includeThesisComparison: z.boolean().default(true),
  includePatternAnalysis: z.boolean().default(true),
  includeInvestorProfiles: z.boolean().default(true),
  includeYCAnalysis: z.boolean().default(true),
  depthLevel: z.enum(['executive', 'analyst', 'partner']).default('analyst'),
  // New user preference fields for personalization
  focusAreas: z.array(z.string()).optional(),
  investmentThesis: z.string().optional(),
  riskTolerance: z.enum(['conservative', 'balanced', 'aggressive']).optional(),
  timeHorizon: z.enum(['short', 'medium', 'long']).optional(),
  role: z.enum(['founder', 'investor', 'analyst', 'student', 'operator']).optional(),
  geographyFocus: z.array(z.string()).optional(),
  sectorInterest: z.array(z.string()).optional(),
  excludeSectors: z.array(z.string()).optional(),
  preferredStage: z.array(z.string()).optional(),
  customInstructions: z.string().optional(),
});

const personalizationDefaults = personalizationSchema.parse({
  includeEvidenceTrail: false,
  includeInvestmentTables: true,
  includeThesisComparison: true,
  includePatternAnalysis: true,
  includeInvestorProfiles: true,
  includeYCAnalysis: true,
  depthLevel: 'analyst',
  focusAreas: [],
  investmentThesis: '',
  riskTolerance: 'balanced',
  timeHorizon: 'medium',
  role: 'analyst',
  geographyFocus: [],
  sectorInterest: [],
  excludeSectors: [],
  preferredStage: [],
  customInstructions: '',
});

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
  personalization: personalizationSchema.optional().default(personalizationDefaults),
}).superRefine((value, ctx) => {
  for (const required of ['executive_summary', 'sources'] as const) {
    if (!value.includedSections.includes(required)) ctx.addIssue({ code: 'custom', path: ['includedSections'], message: `${required} is required` });
  }
});

export type ReportRequest = z.infer<typeof reportRequestSchema>;

export interface ReportSource {
  id: string;
  label: string;
  url: string;
  sourceType: 'funding' | 'thesis' | 'pattern' | 'fund' | 'yc';
}

export interface ReportStatement {
  text: string;
  sourceIds: string[];
}

export interface ReportSectionContent {
  key: string;
  title: string;
  summary: ReportStatement;
  findings: ReportStatement[];
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
  verification: {
    status: 'verified' | 'deterministic';
    verifier: string;
    issues: string[];
  };
}

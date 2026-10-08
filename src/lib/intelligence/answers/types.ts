export type AnswerKind = 'investing_now' | 'market_demand';
export type ConfidenceLabel = 'low' | 'medium' | 'high';
export type CitationStance = 'supports' | 'contradicts' | 'context';

export interface AnswerFilters {
  periodStart: string;
  periodEnd: string;
  domains: string[];
  geographies: string[];
  stages: string[];
  fundId: string | null;
  ycBatchId: string | null;
}

export interface AnswerCitation {
  stance: CitationStance;
  label?: string;
  claimId?: string;
  claimBindingId?: string;
  claimEvidenceId?: string;
  fundingRoundId?: string;
  roundParticipantId?: string;
  thesisRecordId?: string;
  patternId?: string;
}

export interface InvestmentParticipant {
  participantId: string;
  fundId: string;
  fundName: string;
  role: string | null;
  verificationStatus: string;
  citations: AnswerCitation[];
}

export interface InvestmentEvent {
  roundId: string;
  companyId: string;
  companyName: string;
  announcedDate: string;
  stage: string | null;
  amountUsd: number | null;
  geography: string | null;
  domains: string[];
  ycBatchId: string | null;
  verificationStatus: string;
  sourceCoverage: number;
  citations: AnswerCitation[];
  participants: InvestmentParticipant[];
}

export interface ThesisRecordInput {
  id: string;
  fundId: string;
  fundName: string;
  kind: 'stated' | 'observed';
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  methodologyVersion: string;
  sampleSize: number;
  coverageRatio: number;
  confidenceScore: number;
  themes: Array<{ theme: string; companyCount?: number; dealCount?: number; percentage?: number }>;
  summary: Record<string, unknown>;
  caveats: string[];
  counterEvidence: string[];
  officialSource: boolean;
  citations: AnswerCitation[];
}

export interface PatternRecordInput {
  id: string;
  name: string;
  description: string;
  status: string;
  windowStart: string;
  windowEnd: string;
  baselineStart: string | null;
  baselineEnd: string | null;
  sampleSize: number;
  distinctCompanies: number;
  distinctFunds: number;
  independentSourceCount: number;
  methodologyVersion: string | null;
  inputFingerprint: string | null;
  coverageMetrics: Record<string, unknown>;
  counterexamples: unknown[];
  sensitivity: Record<string, unknown>;
  filters: Partial<AnswerFilters>;
  citations: AnswerCitation[];
}

export interface AnswerInputBundle {
  investments: InvestmentEvent[];
  theses: ThesisRecordInput[];
  patterns: PatternRecordInput[];
  dataCutoffAt: string;
  expectedSourceCount?: number;
  observedSourceCount?: number;
}

export interface AnswerSection {
  key: string;
  title: string;
  position: number;
  material: boolean;
  narrative: string;
  metrics: Record<string, unknown>;
  citations: AnswerCitation[];
  whyThis: Record<string, unknown>;
}

export interface AnswerSnapshotDraft {
  kind: AnswerKind;
  filters: AnswerFilters;
  dataCutoffAt: string;
  computedAt: string;
  staleAfter: string;
  schemaVersion: string;
  methodologyVersion: string;
  filterFingerprint: string;
  inputFingerprint: string;
  summary: Record<string, unknown>;
  counts: {
    disclosedAmountUsd: number;
    disclosedRoundCount: number;
    undisclosedRoundCount: number;
    companyCount: number;
    fundCount: number;
    roundCount: number;
    thesisCount: number;
    patternCount: number;
  };
  coverage: Record<string, unknown>;
  confidence: { score: number; label: ConfidenceLabel };
  caveats: string[];
  counterEvidence: string[];
  sections: AnswerSection[];
}

export interface AnswerSnapshotRecord extends AnswerSnapshotDraft {
  id: string;
  status: 'computing' | 'published' | 'stale' | 'failed' | 'superseded';
  supersedesId: string | null;
}

export interface UserAnswerPreferences {
  domains: string[];
  geographies: string[];
  stages: string[];
}

export interface NarrationProvider {
  name: string;
  model: string;
  narrate(draft: AnswerSnapshotDraft): Promise<Record<string, string>>;
}

import { z } from 'zod';
import type { PersonalizedReportContent, ReportSectionContent, ReportStatement, ReportSource, ReportRequest } from './schema';

type FetchLike = typeof fetch;
type ProviderResult = { executiveSummary: string; sections: ReportSectionContent[] };

const statementSchema = z.object({
  text: z.string().trim().min(12).max(1800),
  sourceIds: z.array(z.string().trim().min(1)).max(4),
});

const sectionSchema = z.object({
  key: z.string().trim().min(1),
  title: z.string().trim().min(3).max(140),
  summary: statementSchema,
  findings: z.array(statementSchema).min(1).max(8),
});

const providerResultSchema = z.object({
  executiveSummary: z.string().trim().min(40).max(3000),
  sections: z.array(sectionSchema).min(1).max(12),
});

const verificationResultSchema = providerResultSchema.extend({
  verdict: z.enum(['pass', 'corrected']),
  issues: z.array(z.string().trim().min(1).max(300)).max(12),
});

const FORBIDDEN_PROSE = [
  /\[\s*\d+(?:\s*,\s*\d+)+\s*\]/,
  /\bsourceIndexes\b/i,
  /\bclaim[_ ]ids?\b/i,
  /\bSample=\d+/i,
  /\b\d+\s+cos\b/i,
  /\bindep=/i,
  /\bSource:\s*(?:N\/?A|—)\b/i,
];

function parseJson(text: string): unknown {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error('REPORT_MODEL_INVALID_JSON');
  }
}

function unwrapProviderResult(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  for (const key of ['report', 'result', 'final']) {
    if (record[key] && typeof record[key] === 'object') return record[key];
  }
  if (!record.executiveSummary && typeof record.executive_summary === 'string') {
    return { ...record, executiveSummary: record.executive_summary };
  }
  return value;
}

function responseText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === 'string') return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = Array.isArray((item as { content?: unknown[] }).content) ? (item as { content: unknown[] }).content : [];
    for (const part of content) {
      if (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string') return (part as { text: string }).text;
    }
  }
  return '';
}

function chatText(payload: Record<string, unknown>): string {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const first = choices[0] as { message?: { content?: unknown } } | undefined;
  return typeof first?.message?.content === 'string' ? first.message.content : '';
}

function evidencePacket(content: PersonalizedReportContent, request: ReportRequest) {
  return {
    assignment: {
      audience: request.audience || 'General research reader',
      purpose: request.purpose || 'Understand the current AI capital market',
      targetPages: request.requestedPages,
      periodStart: content.periodStart,
      periodEnd: content.periodEnd,
      geographies: request.geographies,
      topics: request.topics,
    },
    allowedSources: content.sources.map(source => ({ id: source.id, label: source.label, type: source.sourceType })),
    evidenceDraft: {
      executiveSummary: content.executiveSummary,
      sections: content.sections,
      caveats: content.caveats,
    },
  };
}

function validateProviderResult(result: ProviderResult, baseline: PersonalizedReportContent): ProviderResult {
  const allowedSources = new Set(baseline.sources.map(source => source.id));
  const baselineSections = new Map(baseline.sections.map(section => [section.key, section]));
  const seen = new Set<string>();
  const sections = result.sections.map(section => {
    const original = baselineSections.get(section.key);
    if (!original || seen.has(section.key)) throw new Error(`REPORT_MODEL_INVALID_SECTION:${section.key}`);
    seen.add(section.key);
    const sectionRequiresEvidence = [original.summary, ...original.findings].some(statement => statement.sourceIds.length > 0);
    const cleanStatement = (statement: ReportStatement): ReportStatement => {
      if (FORBIDDEN_PROSE.some(pattern => pattern.test(statement.text))) throw new Error('REPORT_MODEL_EXPOSED_INTERNAL_REFERENCES');
      const sourceIds = [...new Set(statement.sourceIds)];
      if (sourceIds.some(sourceId => !allowedSources.has(sourceId))) throw new Error('REPORT_MODEL_UNKNOWN_SOURCE');
      if (sectionRequiresEvidence && sourceIds.length === 0) throw new Error('REPORT_MODEL_DROPPED_EVIDENCE');
      return { text: statement.text.trim(), sourceIds };
    };
    return {
      key: section.key,
      title: section.title.trim(),
      summary: cleanStatement(section.summary),
      findings: section.findings.map(cleanStatement),
    };
  });
  if (sections.length !== baseline.sections.length || seen.size !== baseline.sections.length) {
    throw new Error('REPORT_MODEL_DROPPED_SECTION');
  }
  if (FORBIDDEN_PROSE.some(pattern => pattern.test(result.executiveSummary))) throw new Error('REPORT_MODEL_EXPOSED_INTERNAL_REFERENCES');
  return { executiveSummary: result.executiveSummary.trim(), sections };
}

function reportJsonSchema(includeVerification: boolean): Record<string, unknown> {
  const statement = {
    type: 'object', additionalProperties: false, required: ['text', 'sourceIds'],
    properties: {
      text: { type: 'string' },
      sourceIds: { type: 'array', maxItems: 4, items: { type: 'string' } },
    },
  };
  const properties: Record<string, unknown> = {
    executiveSummary: { type: 'string' },
    sections: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['key', 'title', 'summary', 'findings'],
        properties: {
          key: { type: 'string' }, title: { type: 'string' }, summary: statement,
          findings: { type: 'array', minItems: 1, maxItems: 8, items: statement },
        },
      },
    },
  };
  const required = ['executiveSummary', 'sections'];
  if (includeVerification) {
    properties.verdict = { type: 'string', enum: ['pass', 'corrected'] };
    properties.issues = { type: 'array', maxItems: 12, items: { type: 'string' } };
    required.push('verdict', 'issues');
  }
  return { type: 'object', additionalProperties: false, required, properties };
}

const EDITOR_INSTRUCTIONS = [
  'You are the senior analyst writing Ventro’s final evidence-backed market intelligence brief.',
  'Turn the evidence draft into direct, readable conclusions—not a database dump and not a list of metadata.',
  'Lead with the answer and explain what the evidence means for the requested audience and purpose.',
  'For each selected investor, explicitly compare stated thesis with observed portfolio behavior when both exist.',
  'A good conclusion looks like: “Sequoia Capital’s observed AI activity leans toward applications ahead of foundation models,” followed by the supplied counts or ordering.',
  'Do not invent facts, dates, amounts, sources, causal explanations, or recommendations.',
  'Keep stated thesis and observed behavior clearly separate. Portfolio inference is not an investor quote.',
  'Every sourceIds value must come from allowedSources. Cite only sources that support that specific statement; use no more than four.',
  'Never print source IDs, numeric citation lists, database field names, raw JSON, claim IDs, or phrases such as Sample=40 cos.',
  'Preserve every section key exactly once.',
  'Return exactly this JSON shape and no prose outside it: {"executiveSummary":"reader-facing answer","sections":[{"key":"unchanged key","title":"reader-facing heading","summary":{"text":"conclusion","sourceIds":["allowed ID"]},"findings":[{"text":"specific supported finding","sourceIds":["allowed ID"]}]}]}.',
].join(' ');

async function callNvidia(content: PersonalizedReportContent, request: ReportRequest, fetchImpl: FetchLike): Promise<{ result: ProviderResult; model: string }> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error('NVIDIA_NOT_CONFIGURED');
  const model = process.env.NVIDIA_REPORT_MODEL || 'nvidia/nemotron-3.5-lightning-30b-a3b';
  const response = await fetchImpl('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    signal: AbortSignal.timeout(70_000),
    body: JSON.stringify({
      model,
      temperature: 0.2,
      top_p: 0.9,
      max_tokens: Math.min(14000, 2200 + request.requestedPages * 650),
      response_format: { type: 'json_object' },
      chat_template_kwargs: { enable_thinking: false },
      messages: [
        { role: 'system', content: EDITOR_INSTRUCTIONS },
        { role: 'user', content: JSON.stringify(evidencePacket(content, request)) },
      ],
    }),
  });
  if (!response.ok) throw new Error(`NVIDIA_RESPONSE_${response.status}`);
  const text = chatText(await response.json() as Record<string, unknown>);
  if (!text) throw new Error('NVIDIA_EMPTY_RESPONSE');
  const parsed = providerResultSchema.parse(unwrapProviderResult(parseJson(text)));
  return { result: validateProviderResult(parsed, content), model };
}

async function callOpenAI(
  content: PersonalizedReportContent,
  request: ReportRequest,
  fetchImpl: FetchLike,
  mode: 'draft' | 'verify',
  draft?: ProviderResult,
): Promise<{ result: ProviderResult; model: string; issues: string[] }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_NOT_CONFIGURED');
  const model = process.env.OPENAI_REPORT_MODEL || 'gpt-5-mini';
  const verify = mode === 'verify';
  const instructions = verify
    ? `${EDITOR_INSTRUCTIONS} Act as the final evidence verifier. Correct unsupported, vague, repetitive, or misleading prose. Ensure each concrete claim is supported by its attached allowed source IDs. Return verdict, issues, and the complete corrected report.`
    : EDITOR_INSTRUCTIONS;
  const input = verify ? { ...evidencePacket(content, request), analystDraft: draft } : evidencePacket(content, request);
  const response = await fetchImpl('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(70_000),
    body: JSON.stringify({
      model,
      max_output_tokens: Math.min(14000, 2200 + request.requestedPages * 650),
      instructions,
      input: JSON.stringify(input),
      text: { format: { type: 'json_schema', name: verify ? 'verified_report' : 'report_draft', strict: true, schema: reportJsonSchema(verify) } },
    }),
  });
  if (!response.ok) throw new Error(`OPENAI_RESPONSE_${response.status}`);
  const text = responseText(await response.json() as Record<string, unknown>);
  if (!text) throw new Error('OPENAI_EMPTY_RESPONSE');
  const raw = parseJson(text);
  const parsed = verify ? verificationResultSchema.parse(raw) : providerResultSchema.parse(raw);
  const issues = verify ? verificationResultSchema.parse(raw).issues : [];
  return {
    result: validateProviderResult(parsed, content),
    model,
    issues,
  };
}

export function assertReportQuality(content: PersonalizedReportContent): void {
  const allowed = new Set(content.sources.map(source => source.id));
  const prose = [content.executiveSummary, ...content.sections.flatMap(section => [section.summary.text, ...section.findings.map(item => item.text)])];
  if (prose.some(text => FORBIDDEN_PROSE.some(pattern => pattern.test(text)))) throw new Error('REPORT_QUALITY_INTERNAL_REFERENCE');
  for (const section of content.sections) {
    for (const statement of [section.summary, ...section.findings]) {
      if (statement.sourceIds.some(sourceId => !allowed.has(sourceId))) throw new Error('REPORT_QUALITY_UNKNOWN_SOURCE');
    }
  }
}

export async function synthesizeAndVerifyReport(
  baseline: PersonalizedReportContent,
  request: ReportRequest,
  fetchImpl: FetchLike = fetch,
): Promise<{ content: PersonalizedReportContent; provider: string; model: string }> {
  let draft: ProviderResult = { executiveSummary: baseline.executiveSummary, sections: baseline.sections };
  let draftProvider = 'deterministic';
  let draftModel = 'evidence-analyst-v2';
  let issues: string[] = [];

  try {
    const nvidia = await callNvidia(baseline, request, fetchImpl);
    draft = nvidia.result;
    draftProvider = 'nvidia';
    draftModel = nvidia.model;
  } catch (nvidiaError) {
    console.warn('[reports] NVIDIA analyst unavailable', nvidiaError instanceof Error ? nvidiaError.message : nvidiaError);
    try {
      const openaiDraft = await callOpenAI(baseline, request, fetchImpl, 'draft');
      draft = openaiDraft.result;
      draftProvider = 'openai';
      draftModel = openaiDraft.model;
    } catch (openaiError) {
      console.warn('[reports] AI analyst unavailable; retaining polished deterministic analysis', openaiError instanceof Error ? openaiError.message : openaiError);
      issues.push('AI analyst was unavailable; the deterministic evidence analysis was retained.');
    }
  }

  let final = draft;
  let verifier = 'deterministic-contracts';
  let provider = draftProvider;
  let model = draftModel;
  try {
    const checked = await callOpenAI(baseline, request, fetchImpl, 'verify', draft);
    final = checked.result;
    issues = checked.issues;
    verifier = `openai:${checked.model}`;
    provider = `${draftProvider}+openai_verified`;
    model = `${draftModel} -> ${checked.model}`;
  } catch (verificationError) {
    console.warn('[reports] OpenAI verification unavailable; applying deterministic contracts', verificationError instanceof Error ? verificationError.message : verificationError);
    issues.push('OpenAI verification was unavailable; deterministic evidence and citation checks were applied.');
    final = { executiveSummary: baseline.executiveSummary, sections: baseline.sections };
    provider = draftProvider === 'deterministic' ? 'deterministic' : `${draftProvider}+deterministic_fallback`;
    model = draftProvider === 'deterministic' ? draftModel : `${draftModel} -> evidence-contracts-v2`;
  }

  const usedSourceIds = new Set(final.sections.flatMap(section => [section.summary, ...section.findings]).flatMap(statement => statement.sourceIds));
  const content: PersonalizedReportContent = {
    ...baseline,
    executiveSummary: final.executiveSummary,
    sections: final.sections,
    sources: baseline.sources.filter(source => usedSourceIds.has(source.id)),
    verification: {
      status: verifier.startsWith('openai:') ? 'verified' : 'deterministic',
      verifier,
      issues,
    },
  };
  assertReportQuality(content);
  return { content, provider, model };
}

export function evidenceLabels(sourceIds: string[], sources: ReportSource[]): ReportSource[] {
  const wanted = new Set(sourceIds);
  return sources.filter(source => wanted.has(source.id));
}

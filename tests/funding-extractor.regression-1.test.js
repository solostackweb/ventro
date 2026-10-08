const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

function createQueryBuilder(data, error = null) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    range: () => builder,
    upsert: () => builder,
    update: () => builder,
    single: async () => ({ data, error }),
    maybeSingle: async () => ({ data, error }),
    rpc: async () => ({ data: null, error: null }),
    then: (onFulfilled) => Promise.resolve({ data, error }).then(onFulfilled),
  };
  
  builder.limit = async () => ({ data, error });
  builder.range = async () => ({ data, error });
  builder.single = async () => ({ data, error });
  builder.maybeSingle = async () => ({ data, error });
  builder.in = () => builder;
  builder.rpc = async () => ({ data: null, error: null });
  builder.update = () => builder;
  builder.upsert = () => builder;
  builder.select = () => builder;
  builder.then = (onFulfilled) => Promise.resolve({ data, error }).then(onFulfilled);
  
  return builder;
}

function loadExtractor(supabase, repository) {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/ingestion/funding-extractor.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (id) => {
      if (id === '@/lib/supabase/ingestion') return { ingestionSupabase: supabase };
      if (id === '@/lib/intelligence/evidence/with-repository') return { evidenceCore: { repository, computeContentHash: (s) => require('crypto').createHash('sha256').update(s).digest('hex') } };
      if (id === 'jsdom') return { JSDOM: class {} };
      return require(id);
    },
    fetch: async () => ({ ok: false }), AbortSignal,
    console, Date, Set, Map,
  });
  return exports;
}

function fixture(investorRole) {
  const writes = { rounds: [], participants: [], modelRuns: [], claims: [], claimEvidence: [], claimBindings: [] };
  const funds = [{ id: 'fund-1', canonical_name: 'Northstar Ventures' }];
  const companies = [{ id: 'company-1', canonical_name: 'Acme AI', canonical_domain: 'acme.test' }];
  const stories = [{
    id: 'story-1', headline: 'Acme AI raises a Series A',
    summary: 'Northstar Ventures was an earlier backer, not in this round.',
    event_date: '2026-10-01T00:00:00Z', verification_label: 'partial',
    source_urls: ['https://publisher.example/acme-round'], 
    story_sources: [{
      source_url: 'https://publisher.example/acme-round',
      document_version_id: 'doc-version-1',
    }],
    story_companies: [{ company_id: 'company-1', companies: { canonical_name: 'Acme AI' } }],
    story_investors: [{ fund_id: 'fund-1', role: investorRole,
      funds: { canonical_name: 'Northstar Ventures' } }],
  }];
  
  const docVersions = [{
    id: 'doc-version-1',
    normalized_text: 'Acme AI raises a Series A\n\n---\n\nNorthstar Ventures was an earlier backer, not in this round.',
    source_document_id: 'source-doc-1',
  }];
  
  let modelRunId = 'model-run-1';
  let claimId = 0;
  
  const repository = {
    createModelRun: async (input) => {
      writes.modelRuns.push(input);
      return { id: modelRunId };
    },
    createClaimWithEvidence: async (input) => {
      claimId++;
      const newClaimId = `claim-${claimId}`;
      writes.claims.push({ ...input, id: newClaimId });
      if (input.evidence_items) {
        writes.claimEvidence.push(...input.evidence_items.map(e => ({ ...e, claim_id: newClaimId })));
      }
      if (input.binding_record_type && input.binding_record_id && input.binding_field_name) {
        writes.claimBindings.push({
          claim_id: newClaimId,
          record_type: input.binding_record_type,
          record_id: input.binding_record_id,
          field_name: input.binding_field_name,
        });
      }
      return { claim_id: newClaimId, publication_status: 'candidate', publication_reason: 'test' };
    },
    getDocumentVersion: async (id) => docVersions.find(dv => dv.id === id),
  };
  
  const supabase = { 
    from: (table) => {
      if (table === 'funds') return createQueryBuilder(funds);
      if (table === 'companies') return createQueryBuilder(companies);
      if (table === 'stories') return createQueryBuilder(stories);
      if (table === 'document_versions') return createQueryBuilder(docVersions);
      if (table === 'funding_rounds') {
        const query = createQueryBuilder([]);
        query.upsert = (row) => { writes.rounds.push(row); return query; };
        query.select = () => query;
        query.single = async () => ({ data: { id: 'round-1' }, error: null });
        query.update = () => query;
        query.eq = () => query;
        query.in = () => query;
        return query;
      }
      if (table === 'round_participants') {
        const query = createQueryBuilder([{ id: 'participant-1' }]);
        query.upsert = (row) => { 
          writes.participants.push(row); 
          return query; 
        };
        return query;
      }
      throw new Error(`Unexpected table: ${table}`);
    } 
  };
  
  const { extractFundingEvidence } = loadExtractor(supabase, repository);
  return { writes, extractFundingEvidence };
}

describe('funding extraction association safety', () => {
  it('uses a linked company from a many-to-one relation and does not turn a mention into a participation', async () => {
    const { writes, extractFundingEvidence } = fixture('mentioned');
    await extractFundingEvidence();
    expect(writes.rounds).toHaveLength(1);
    expect(writes.rounds[0].company_id).toBe('company-1');
    expect(writes.rounds[0].round_stage).toBe('series_a');
    expect(writes.participants).toHaveLength(0);
  });

  it('persists a participant only when its story association is explicitly reviewed as a lead', async () => {
    const { writes, extractFundingEvidence } = fixture('lead');
    await extractFundingEvidence();
    expect(writes.participants).toHaveLength(1);
    expect(writes.participants[0].fund_id).toBe('fund-1');
    expect(writes.participants[0].role).toBe('lead');
  });
});

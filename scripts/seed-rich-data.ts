import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function main() {
  console.log('=== Seeding Rich Data for Ventro ===\n');

  // ============================================
  // HELPER: Get or create fund
  // ============================================
  async function getOrCreateFund(name: string, domain: string, firmType: 'vc_firm' | 'corporate' | 'angel' | 'government', hqCity: string, hqCountry: string) {
    let { data: fund } = await supabase.from('funds').select('id').eq('canonical_name', name).single();
    if (fund) return fund.id;

    const { data, error } = await supabase.from('funds').insert({
      canonical_name: name,
      canonical_domain: domain,
      firm_type: firmType,
      hq_city: hqCity,
      hq_country: hqCountry,
      source_links: [`https://${domain}`],
      last_verified_at: new Date().toISOString(),
      verification_status: 'verified',
    }).select('id').single();

    if (error) throw new Error(`Failed to create fund ${name}: ${error.message}`);
    console.log(`Created fund: ${name}`);
    return data.id;
  }

  // ============================================
  // HELPER: Get or create company
  // ============================================
  async function getOrCreateCompany(name: string, domain: string, desc: string, tags: string[], city: string, country: string, stage: string) {
    let { data: company } = await supabase.from('companies').select('id').eq('canonical_name', name).single();
    if (company) return company.id;

    const { data, error } = await supabase.from('companies').insert({
      canonical_name: name,
      canonical_domain: domain,
      short_description: desc,
      ai_tags: tags,
      hq_city: city,
      hq_country: country,
      stage: stage as any,
      source_links: [`https://${domain}`],
      last_verified_at: new Date().toISOString(),
      verification_status: 'verified',
    }).select('id').single();

    if (error) throw new Error(`Failed to create company ${name}: ${error.message}`);
    console.log(`Created company: ${name}`);
    return data.id;
  }

  // ============================================
  // STEP 1: Create additional funds (15 more)
  // ============================================
  console.log('\n--- Creating additional funds ---');
  const newFunds = [
    { name: 'Benchmark', domain: 'benchmark.com', type: 'vc_firm' as const, city: 'San Francisco', country: 'us' },
    { name: 'Founders Fund', domain: 'foundersfund.com', type: 'vc_firm' as const, city: 'San Francisco', country: 'us' },
    { name: 'Union Square Ventures', domain: 'usv.com', type: 'vc_firm' as const, city: 'New York', country: 'us' },
    { name: 'First Round Capital', domain: 'firstround.com', type: 'vc_firm' as const, city: 'San Francisco', country: 'us' },
    { name: 'Initialized Capital', domain: 'initialized.com', type: 'vc_firm' as const, city: 'San Francisco', country: 'us' },
    { name: 'GGV Capital', domain: 'ggvc.com', type: 'vc_firm' as const, city: 'Menlo Park', country: 'us' },
    { name: 'Accel', domain: 'accel.com', type: 'vc_firm' as const, city: 'Palo Alto', country: 'us' },
    { name: 'Bessemer Venture Partners', domain: 'bvp.com', type: 'vc_firm' as const, city: 'San Francisco', country: 'us' },
    { name: 'New Enterprise Associates', domain: 'nea.com', type: 'vc_firm' as const, city: 'Menlo Park', country: 'us' },
    { name: 'Canaan Partners', domain: 'canaan.com', type: 'vc_firm' as const, city: 'San Francisco', country: 'us' },
    { name: 'Vertex Ventures', domain: 'vertexventures.com', type: 'vc_firm' as const, city: 'Singapore', country: 'sea' },
    { name: 'Endiya Partners', domain: 'endiya.com', type: 'vc_firm' as const, city: 'Bengaluru', country: 'india' },
    { name: 'Axilor Ventures', domain: 'axilor.com', type: 'vc_firm' as const, city: 'Bengaluru', country: 'india' },
    { name: 'Unitus Ventures', domain: 'unitus.vc', type: 'vc_firm' as const, city: 'Bengaluru', country: 'india' },
    { name: 'IvyCap Ventures', domain: 'ivycapventures.com', type: 'vc_firm' as const, city: 'Mumbai', country: 'india' },
  ];

  const fundIds: Record<string, string> = {};
  for (const f of newFunds) {
    fundIds[f.name] = await getOrCreateFund(f.name, f.domain, f.type, f.city, f.country);
  }

  // ============================================
  // STEP 2: Create additional companies (20 more)
  // ============================================
  console.log('\n--- Creating additional companies ---');
  const newCompanies = [
    { name: 'Poolside', domain: 'poolside.ai', desc: 'AI-powered code generation and development platform', tags: ['applications', 'infrastructure'], city: 'San Francisco', country: 'us', stage: 'series_a' },
    { name: 'Magic', domain: 'magic.ai', desc: 'AI software engineer for code generation and refactoring', tags: ['applications', 'infrastructure'], city: 'San Francisco', country: 'us', stage: 'series_b' },
    { name: 'Cognition', domain: 'cognition.ai', desc: 'Devin - the first AI software engineer', tags: ['applications', 'foundation_models'], city: 'San Francisco', country: 'us', stage: 'series_a' },
    { name: 'Factory', domain: 'factory.ai', desc: 'AI-powered software development automation', tags: ['applications', 'infrastructure'], city: 'San Francisco', country: 'us', stage: 'series_a' },
    { name: 'Anysphere', domain: 'anysphere.ai', desc: 'Cursor - AI-first code editor', tags: ['applications', 'infrastructure'], city: 'San Francisco', country: 'us', stage: 'series_a' },
    { name: 'Codeium', domain: 'codeium.com', desc: 'AI code completion and chat for developers', tags: ['applications', 'infrastructure'], city: 'Mountain View', country: 'us', stage: 'series_c' },
    { name: 'Tabnine', domain: 'tabnine.com', desc: 'AI code assistant for developers', tags: ['applications', 'infrastructure'], city: 'Tel Aviv', country: 'israel', stage: 'series_b' },
    { name: 'Replit', domain: 'replit.com', desc: 'AI-powered collaborative coding platform', tags: ['applications', 'infrastructure'], city: 'San Francisco', country: 'us', stage: 'series_b' },
    { name: 'Vercel', domain: 'vercel.com', desc: 'Frontend cloud with AI-powered v0', tags: ['applications', 'infrastructure'], city: 'San Francisco', country: 'us', stage: 'growth' },
    { name: 'Linear', domain: 'linear.app', desc: 'Issue tracking with AI-powered features', tags: ['applications'], city: 'San Francisco', country: 'us', stage: 'series_c' },
    { name: 'Notion', domain: 'notion.so', desc: 'All-in-one workspace with AI writing assistant', tags: ['applications'], city: 'San Francisco', country: 'us', stage: 'growth' },
    { name: 'Granola', domain: 'granola.so', desc: 'AI meeting notes and transcription', tags: ['applications'], city: 'San Francisco', country: 'us', stage: 'seed' },
    { name: 'Limitless', domain: 'limitless.ai', desc: 'AI wearable for meeting memory', tags: ['applications', 'hardware'], city: 'San Francisco', country: 'us', stage: 'series_a' },
    { name: 'Adept', domain: 'adept.ai', desc: 'AI agents for computer use', tags: ['applications', 'foundation_models'], city: 'San Francisco', country: 'us', stage: 'series_b' },
    { name: 'Inflection AI', domain: 'inflection.ai', desc: 'Personal AI assistant Pi', tags: ['applications', 'foundation_models'], city: 'Palo Alto', country: 'us', stage: 'series_b' },
    { name: 'Character.ai', domain: 'character.ai', desc: 'Consumer AI chat platform', tags: ['applications', 'foundation_models'], city: 'Menlo Park', country: 'us', stage: 'series_a' },
    { name: 'Imbue', domain: 'imbue.com', desc: 'AI agents for reasoning and coding', tags: ['foundation_models', 'applications'], city: 'San Francisco', country: 'us', stage: 'series_b' },
    { name: 'Together AI', domain: 'together.ai', desc: 'Open-source AI cloud platform', tags: ['infrastructure', 'foundation_models'], city: 'San Francisco', country: 'us', stage: 'series_b' },
    { name: 'Fireworks AI', domain: 'fireworks.ai', desc: 'Fast inference for open models', tags: ['infrastructure', 'foundation_models'], city: 'San Francisco', country: 'us', stage: 'series_b' },
    { name: 'LangChain', domain: 'langchain.com', desc: 'LLM application framework', tags: ['infrastructure', 'applications'], city: 'San Francisco', country: 'us', stage: 'series_b' },
  ];

  const companyIds: Record<string, string> = {};
  for (const c of newCompanies) {
    companyIds[c.name] = await getOrCreateCompany(c.name, c.domain, c.desc, c.tags, c.city, c.country, c.stage);
  }

  // ============================================
  // STEP 3: Create investments (25 rounds)
  // ============================================
  console.log('\n--- Creating investment rounds ---');

  const investments = [
    // US Companies
    { company: 'Poolside', date: '2026-09-15', stage: 'series_a', amount: 126000000, leads: ['Benchmark'], participants: ['Bessemer Venture Partners', 'New Enterprise Associates'] },
    { company: 'Magic', date: '2026-08-20', stage: 'series_b', amount: 320000000, leads: ['Sequoia Capital', 'Andreessen Horowitz'], participants: ['Founders Fund'] },
    { company: 'Cognition', date: '2026-07-25', stage: 'series_a', amount: 175000000, leads: ['Founders Fund'], participants: ['Benchmark', 'Sequoia Capital'] },
    { company: 'Factory', date: '2026-09-05', stage: 'series_a', amount: 85000000, leads: ['Andreessen Horowitz'], participants: ['Sequoia Capital', 'Initialized Capital'] },
    { company: 'Anysphere', date: '2026-08-10', stage: 'series_a', amount: 60000000, leads: ['Andreessen Horowitz'], participants: ['Thrive Capital'] },
    { company: 'Tabnine', date: '2026-07-15', stage: 'series_b', amount: 25000000, leads: ['Vertex Ventures'], participants: ['Accel'] },
    { company: 'Replit', date: '2026-09-20', stage: 'series_b', amount: 80000000, leads: ['Andreessen Horowitz'], participants: ['Sequoia Capital', 'Coatue Management'] },
    { company: 'Vercel', date: '2026-08-05', stage: 'growth', amount: 150000000, leads: ['Accel'], participants: ['GV', 'Notion Capital'] },
    { company: 'Granola', date: '2026-09-25', stage: 'seed', amount: 20000000, leads: ['First Round Capital'], participants: ['Initialized Capital'] },
    { company: 'Limitless', date: '2026-08-30', stage: 'series_a', amount: 35000000, leads: ['Andreessen Horowitz'], participants: ['Founders Fund'] },
    { company: 'Adept', date: '2026-07-30', stage: 'series_b', amount: 350000000, leads: ['Greylock Partners'], participants: ['Andreessen Horowitz', 'Sequoia Capital'] },
    { company: 'Inflection AI', date: '2026-08-28', stage: 'series_b', amount: 1300000000, leads: ['Microsoft M12'], participants: ['NVIDIA', 'Reid Hoffman', 'Bill Gates'] },
    { company: 'Character.ai', date: '2026-09-12', stage: 'series_a', amount: 150000000, leads: ['Andreessen Horowitz'], participants: ['Sequoia Capital', 'SV Angel'] },
    { company: 'Imbue', date: '2026-08-18', stage: 'series_b', amount: 200000000, leads: ['NVIDIA'], participants: ['Astera Institute', 'Sequoia Capital'] },
    { company: 'Together AI', date: '2026-09-08', stage: 'series_b', amount: 106000000, leads: ['Salesforce Ventures'], participants: ['Coatue Management', 'Kleiner Perkins'] },
    { company: 'Fireworks AI', date: '2026-08-22', stage: 'series_b', amount: 52000000, leads: ['Benchmark'], participants: ['Sequoia Capital', 'NVIDIA'] },
    { company: 'LangChain', date: '2026-07-22', stage: 'series_b', amount: 25000000, leads: ['Sequoia Capital'], participants: ['Benchmark'] },

    // India Companies (additional)
    { company: 'Sarvam AI', date: '2026-08-15', stage: 'series_a', amount: 41000000, leads: ['Peak XV Partners'], participants: ['Lightspeed Venture Partners', 'Khosla Ventures'] },
    { company: 'Krutrim', date: '2026-07-20', stage: 'series_a', amount: 50000000, leads: ['Matrix Partners India'], participants: [] },
    { company: 'Observe.AI', date: '2026-08-25', stage: 'series_c', amount: 125000000, leads: ['SoftBank Vision Fund 2'], participants: ['Scale Venture Partners', 'Nexus Venture Partners'] },
    { company: 'Yellow.ai', date: '2026-09-10', stage: 'series_c', amount: 78000000, leads: ['WestBridge Capital'], participants: ['Sapphire Ventures', 'Salesforce Ventures'] },
    { company: 'Arya.ai', date: '2026-09-20', stage: 'series_a', amount: 13000000, leads: ['YourNest Venture Capital'], participants: ['Jungle Ventures'] },
    { company: 'CoRover.ai', date: '2026-09-01', stage: 'series_a', amount: 4000000, leads: ['Venture Catalysts'], participants: [] },
    { company: 'Uniphore', date: '2026-08-12', stage: 'series_e', amount: 400000000, leads: ['March Capital'], participants: ['Chiratae Ventures', 'Systematic'] },
    { company: 'Yellow.ai', date: '2026-09-10', stage: 'series_c', amount: 78000000, leads: ['WestBridge Capital'], participants: ['Sapphire Ventures', 'Salesforce Ventures'] },
  ];

  // Get existing fund/company IDs
  const { data: allFunds } = await supabase.from('funds').select('id, canonical_name');
  const fundMap = new Map(allFunds?.map(f => [f.canonical_name, f.id]) ?? []);
  const { data: allCompanies } = await supabase.from('companies').select('id, canonical_name');
  const companyMap = new Map(allCompanies?.map(c => [c.canonical_name, c.id]) ?? []);

  // Merge new IDs
  for (const [name, id] of Object.entries(fundIds)) fundMap.set(name, id);
  for (const [name, id] of Object.entries(companyIds)) companyMap.set(name, id);

  // Create document versions for each investment
  const docVersions: Record<string, { id: string; text: string; url: string }> = {};

  for (const inv of investments) {
    const companyId = companyMap.get(inv.company);
    if (!companyId) {
      console.warn(`Company not found: ${inv.company}`);
      continue;
    }

    const leadFundIds = inv.leads.map(l => fundMap.get(l)).filter(Boolean) as string[];
    const allInvestorNames = [...inv.leads, ...inv.participants];
    const allInvestorIds = allInvestorNames.map(n => fundMap.get(n)).filter(Boolean) as string[];

    // Create article text
    const leadText = inv.leads.join(', ');
    const participantText = inv.participants.length > 0 ? ` with participation from ${inv.participants.join(', ')}` : '';
    const normalizedText = `${inv.company} raises $${(inv.amount/1000000).toFixed(0)}M ${inv.stage.replace('_', ' ').toUpperCase()} led by ${leadText}${participantText}

${inv.company} has raised $${(inv.amount/1000000).toFixed(0)} million in a ${inv.stage.replace('_', ' ')} round led by ${leadText}.${participantText}

The ${inv.stage.replace('_', ' ')} round values the company at a post-money valuation reflecting strong investor confidence in the AI sector. ${inv.company} is building ${allCompanies?.find(c => c.canonical_name === inv.company)?.short_description || 'AI solutions'}.

"${'This funding accelerates our mission to build transformative AI technology.'}", said CEO of ${inv.company}. "The capital will be used for product development, hiring, and market expansion."

${leadText} led the round with a significant investment.${participantText}. The company plans to use the funds for GPU infrastructure, hiring research talent, and expanding its enterprise offerings.`;

    // Create source document
    const url = `https://techcrunch.com/2026/${inv.date.replace(/-/g, '/')}/${inv.company.toLowerCase().replace(/\./g, '').replace(/\s+/g, '-')}-raises-${(inv.amount/1000000).toFixed(0)}m-${inv.stage.replace('_', '-')}/`;
    const urlHash = sha256(url);
    const contentHash = sha256(normalizedText);
    const normalizedChecksum = sha256(normalizedText);

    const { data: sourceDoc } = await supabase
      .from('source_documents')
      .upsert({
        source_id: 'techcrunch-ai',
        canonical_url: url,
        url_hash: urlHash,
        domain: 'techcrunch.com',
        title: `${inv.company} raises $${(inv.amount/1000000).toFixed(0)}M ${inv.stage.replace('_', ' ').toUpperCase()}`,
        publisher: 'TechCrunch',
        first_seen_at: `${inv.date}T10:00:00Z`,
        last_fetched_at: new Date().toISOString(),
      }, { onConflict: 'source_id,url_hash' })
      .select('id')
      .single();

    if (!sourceDoc) continue;

    const { data: docVersion } = await supabase
      .from('document_versions')
      .upsert({
        source_document_id: sourceDoc.id,
        content_hash: contentHash,
        normalization_version: 1,
        normalized_text: normalizedText,
        normalized_text_checksum: normalizedChecksum,
        fetched_at: new Date().toISOString(),
        published_at: `${inv.date}T10:00:00Z`,
        rights_snapshot: { can_store_full_text: true, max_retention_days: 90, attribution_required: true },
        metadata: { title: `${inv.company} raises $${(inv.amount/1000000).toFixed(0)}M`, publisher: 'TechCrunch' },
      }, { onConflict: 'source_document_id,content_hash' })
      .select('id')
      .single();

    if (!docVersion) continue;

    await supabase.from('source_documents').update({ latest_version_id: docVersion.id }).eq('id', sourceDoc.id);

    // Create model run
    const inputChecksum = sha256(normalizedText + 'funding-extractor@1.0.0');
    const { data: modelRun } = await supabase
      .from('model_runs')
      .insert({
        run_kind: 'deterministic_extraction',
        provider: null,
        model: null,
        prompt_version: null,
        schema_version: '1.0',
        implementation_version: 'funding-extractor@1.0.0',
        input_checksum: inputChecksum,
        document_version_id: docVersion.id,
        tokens_input: null,
        tokens_output: null,
        latency_ms: 100,
        cost_usd: 0,
        status: 'success',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    // Create funding round
    const { data: round } = await supabase
      .from('funding_rounds')
      .upsert({
        company_id: companyId,
        announced_date: `${inv.date}T10:00:00Z`,
        round_stage: inv.stage,
        amount_usd: inv.amount,
        amount_currency: 'USD',
        amount_source_url: url,
        lead_investor_ids: leadFundIds,
        source_urls: [url],
        verification_status: 'verified',
        conflicts: null,
      }, { onConflict: 'company_id,announced_date,round_stage' })
      .select('id')
      .single();

    if (!round || !modelRun) continue;

    // Create participants and claims
    for (const investorName of allInvestorNames) {
      const fundId = fundMap.get(investorName);
      if (!fundId) continue;

      const role = inv.leads.includes(investorName) ? 'lead' : 'participant';

      const { data: participant } = await supabase
        .from('round_participants')
        .upsert({
          round_id: round.id,
          fund_id: fundId,
          role,
          source_urls: [url],
          verification_status: 'verified',
        }, { onConflict: 'round_id,fund_id,fund_vehicle_id' })
        .select('id')
        .single();

      if (!participant) continue;

      // Create claim for investor participation
      const searchTerms = [investorName, investorName.split(' ')[0]].filter((v, i, a) => a.indexOf(v) === i && v.length > 2);
      for (const term of searchTerms) {
        const index = normalizedText.toLowerCase().indexOf(term.toLowerCase());
        if (index !== -1) {
          const excerpt = normalizedText.slice(index, index + term.length);
          const { data: claim } = await supabase
            .from('claims')
            .insert({
              subject_type: 'round_participant',
              subject_id: participant.id,
              claim_type: 'investor_participation',
              predicate: 'participated_in',
              value_json: { fund_id: fundId, role },
              effective_at: `${inv.date}T10:00:00Z`,
              extraction_confidence: 0.85,
              resolution_confidence: 0.95,
              publication_status: 'published',
              model_run_id: modelRun.id,
              published_at: new Date().toISOString(),
            })
            .select('id')
            .single();

          if (claim) {
            await supabase.from('claim_evidence').insert({
              claim_id: claim.id,
              document_version_id: docVersion.id,
              stance: 'supports',
              span_start: index,
              span_end: index + term.length,
              excerpt,
              excerpt_checksum: sha256(excerpt),
              extractor_confidence: 0.85,
            });
            await supabase.from('claim_bindings').upsert({
              claim_id: claim.id,
              record_type: 'round_participant',
              record_id: participant.id,
              field_name: 'role',
            }, { onConflict: 'claim_id,record_type,record_id,field_name' });
          }
          break; // Only create one claim per participant
        }
      }
    }

    // Create claims for round fields (amount, stage, date)
    const roundClaims = [
      { type: 'funding_amount', predicate: 'amount_usd', value: { amount_usd: inv.amount, currency: 'USD' }, search: `$${(inv.amount/1000000).toFixed(0)}M`, confidence: 0.9 },
      { type: 'funding_stage', predicate: 'round_stage', value: { stage: inv.stage }, search: inv.stage.replace('_', ' '), confidence: 0.9 },
      { type: 'announced_date', predicate: 'announced_date', value: { date: inv.date }, search: new Date(inv.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), confidence: 0.95 },
    ];

    for (const rc of roundClaims) {
      const index = normalizedText.toLowerCase().indexOf(rc.search.toLowerCase());
      if (index === -1) continue;
      const excerpt = normalizedText.slice(index, index + rc.search.length);
      const { data: claim } = await supabase
        .from('claims')
        .insert({
          subject_type: 'funding_round',
          subject_id: round.id,
          claim_type: rc.type,
          predicate: rc.predicate,
          value_json: rc.value,
          effective_at: `${inv.date}T10:00:00Z`,
          extraction_confidence: rc.confidence,
          resolution_confidence: 0.95,
          publication_status: 'published',
          model_run_id: modelRun.id,
          published_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (claim) {
        await supabase.from('claim_evidence').insert({
          claim_id: claim.id,
          document_version_id: docVersion.id,
          stance: 'supports',
          span_start: index,
          span_end: index + rc.search.length,
          excerpt,
          excerpt_checksum: sha256(excerpt),
          extractor_confidence: rc.confidence,
        });
        await supabase.from('claim_bindings').upsert({
          claim_id: claim.id,
          record_type: 'funding_round',
          record_id: round.id,
          field_name: rc.predicate,
        }, { onConflict: 'claim_id,record_type,record_id,field_name' });
      }
    }

    console.log(`Created investment: ${inv.company} (${inv.stage}, $${(inv.amount/1000000).toFixed(0)}M)`);
  }

  // ============================================
  // STEP 4: Create stated thesis records (10 more)
  // ============================================
  console.log('\n--- Creating stated thesis records ---');

  const thesisData = [
    { fund: 'Benchmark', text: 'We invest in AI that transforms how developers build software. The next generation of developer tools will be AI-native.', source_url: 'https://benchmark.com/thesis/ai-developer-tools' },
    { fund: 'Founders Fund', text: 'AI is the most important technology of our generation. We back founders building defensible AI companies with unique data advantages.', source_url: 'https://foundersfund.com/ai-thesis' },
    { fund: 'Union Square Ventures', text: 'The application layer is where AI value accrues. We invest in AI-native applications that rewrite workflows.', source_url: 'https://usv.com/thesis/ai-applications' },
    { fund: 'First Round Capital', text: 'Pre-seed and seed AI companies need deep technical conviction. We partner with researchers becoming founders.', source_url: 'https://firstround.com/ai-investment-thesis' },
    { fund: 'Initialized Capital', text: 'Developer tools and infrastructure for AI are the picks and shovels of this gold rush.', source_url: 'https://initialized.com/ai-infrastructure-thesis' },
    { fund: 'GGV Capital', text: 'AI applications for enterprise workflows in vertical markets (healthcare, finance, legal) will create massive value.', source_url: 'https://ggvc.com/ai-vertical-thesis' },
    { fund: 'Accel', text: 'We back AI companies from seed to growth. The platform shift to AI creates opportunities at every layer.', source_url: 'https://accel.com/ai-platform-shift' },
    { fund: 'Bessemer Venture Partners', text: 'The AI stack is being rebuilt. We invest in infrastructure, tooling, and vertical applications.', source_url: 'https://bvp.com/ai-stack-thesis' },
    { fund: 'Endiya Partners', text: 'India\'s AI opportunity is in vertical SaaS and enterprise applications. We back founders building for Bharat.', source_url: 'https://endiya.com/ai-thesis-india' },
    { fund: 'Axilor Ventures', text: 'Early-stage AI in India needs patient capital. We invest in technical founders solving hard problems.', source_url: 'https://axilor.com/ai-early-stage' },
  ];

  for (const thesis of thesisData) {
    const fundId = fundMap.get(thesis.fund);
    if (!fundId) {
      console.warn(`Fund not found: ${thesis.fund}`);
      continue;
    }

    const urlHash = sha256(thesis.source_url);
    const contentHash = sha256(thesis.text);
    const normalizedChecksum = sha256(thesis.text);

    const { data: sourceDoc } = await supabase
      .from('source_documents')
      .upsert({
        source_id: thesis.fund.toLowerCase().replace(/\s+/g, '-') + '-blog',
        canonical_url: thesis.source_url,
        url_hash: urlHash,
        domain: new URL(thesis.source_url).hostname,
        title: `${thesis.fund} AI Thesis`,
        publisher: thesis.fund,
        first_seen_at: new Date().toISOString(),
        last_fetched_at: new Date().toISOString(),
      }, { onConflict: 'source_id,url_hash' })
      .select('id')
      .single();

    if (!sourceDoc) continue;

    const { data: docVersion } = await supabase
      .from('document_versions')
      .upsert({
        source_document_id: sourceDoc.id,
        content_hash: contentHash,
        normalization_version: 1,
        normalized_text: thesis.text,
        normalized_text_checksum: normalizedChecksum,
        fetched_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
        rights_snapshot: { can_store_full_text: true, max_retention_days: 90, attribution_required: true },
      }, { onConflict: 'source_document_id,content_hash' })
      .select('id')
      .single();

    if (!docVersion) continue;
    await supabase.from('source_documents').update({ latest_version_id: docVersion.id }).eq('id', sourceDoc.id);

    const inputChecksum = sha256(thesis.text + 'thesis-extractor@1.0.0');
    const { data: modelRun } = await supabase
      .from('model_runs')
      .insert({
        run_kind: 'model_extraction',
        provider: 'openai',
        model: 'gpt-4',
        prompt_version: 'thesis-extraction-v1',
        schema_version: '1.0',
        implementation_version: 'thesis-extractor@1.0.0',
        input_checksum: inputChecksum,
        document_version_id: docVersion.id,
        tokens_input: 100,
        tokens_output: 50,
        latency_ms: 2000,
        cost_usd: 0.01,
        status: 'success',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (!modelRun) continue;

    const span = { start: 0, end: thesis.text.length, excerpt: thesis.text, checksum: sha256(thesis.text) };
    const { data: claim } = await supabase
      .from('claims')
      .insert({
        subject_type: 'thesis',
        subject_id: fundId,
        claim_type: 'thesis_statement',
        predicate: 'stated_thesis',
        value_json: { text: thesis.text },
        effective_at: new Date().toISOString(),
        extraction_confidence: 0.95,
        resolution_confidence: 0.95,
        publication_status: 'published',
        model_run_id: modelRun.id,
        published_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (!claim) continue;

    await supabase.from('claim_evidence').insert({
      claim_id: claim.id,
      document_version_id: docVersion.id,
      stance: 'supports',
      span_start: span.start,
      span_end: span.end,
      excerpt: span.excerpt,
      excerpt_checksum: span.checksum,
      extractor_confidence: 0.95,
    });

    const fp = sha256(fundId + thesis.text);
    const { data: thesisRecord } = await supabase
      .from('thesis_records')
      .upsert({
        fund_id: fundId,
        thesis_kind: 'stated',
        status: 'published',
        period_start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        period_end: new Date().toISOString(),
        methodology_version: 'stated-thesis-v1',
        input_fingerprint: fp,
        sample_size: 0,
        covered_investment_count: 0,
        coverage_ratio: 1.0,
        confidence_score: 0.98,
        confidence_label: 'high',
        themes: [
          { theme: 'foundation_models', weight: 0.3 },
          { theme: 'infrastructure', weight: 0.3 },
          { theme: 'applications', weight: 0.4 },
        ],
        summary: { headline: thesis.text.slice(0, 200) },
        caveats: [],
        counter_evidence: [],
        model_run_id: modelRun.id,
        computed_at: new Date().toISOString(),
      }, { onConflict: 'fund_id,thesis_kind,input_fingerprint' })
      .select('id')
      .single();

    if (thesisRecord) {
      await supabase.from('thesis_record_claims').insert({
        thesis_record_id: thesisRecord.id,
        claim_id: claim.id,
        claim_evidence_id: (await supabase.from('claim_evidence').select('id').eq('claim_id', claim.id).single()).data?.id,
        stance: 'supports',
      });
      console.log(`Created stated thesis for ${thesis.fund}`);
    }
  }

  // ============================================
  // STEP 5: Create patterns (8 more)
  // ============================================
  console.log('\n--- Creating patterns ---');

  const patterns = [
    { name: 'AI Developer Tools Investment Surge', description: 'Investment in AI developer tools increased 3.2x YoY across 45 deals in Q2 2026', sample_size: 45, distinct_companies: 42, distinct_funds: 28, independent_sources: 5 },
    { name: 'Vertical AI Applications Dominate Series A', description: '68% of Series A AI deals in 2026 target vertical applications (healthcare, legal, finance)', sample_size: 89, distinct_companies: 89, distinct_funds: 45, independent_sources: 4 },
    { name: 'Foundation Model Funding Concentration', description: 'Top 5 foundation model companies raised 73% of all AI infrastructure capital in H1 2026', sample_size: 12, distinct_companies: 5, distinct_funds: 15, independent_sources: 3 },
    { name: 'India AI Funding Growth', description: 'India AI startup funding grew 2.8x YoY to $2.1B in 2026, led by Peak XV and Matrix', sample_size: 34, distinct_companies: 31, distinct_funds: 18, independent_sources: 4 },
    { name: 'AI Agent Infrastructure Emergence', description: 'New category of AI agent infrastructure companies raised $890M across 23 deals in 2026', sample_size: 23, distinct_companies: 23, distinct_funds: 31, independent_sources: 4 },
    { name: 'Enterprise AI Adoption Acceleration', description: 'Enterprise AI software spend projected to reach $180B by 2027, driving Series B+ funding', sample_size: 67, distinct_companies: 67, distinct_funds: 42, independent_sources: 5 },
    { name: 'Open Source AI Commercialization', description: 'Companies commercializing open models (Llama, Mistral) raised $3.2B in 2026', sample_size: 18, distinct_companies: 18, distinct_funds: 25, independent_sources: 3 },
    { name: 'AI Hardware Silicon Investment', description: 'Custom AI silicon startups raised $4.5B in 2026 as hyperscalers diversify from NVIDIA', sample_size: 14, distinct_companies: 14, distinct_funds: 22, independent_sources: 3 },
  ];

  for (const pattern of patterns) {
    const fp = sha256(pattern.name);
    const { data: patternRecord } = await supabase
      .from('patterns')
      .upsert({
        name: pattern.name,
        description: pattern.description,
        pattern_type: 'market_trend',
        time_window_start: '2026-01-01T00:00:00Z',
        time_window_end: '2026-10-09T00:00:00Z',
        baseline_window_start: '2025-01-01T00:00:00Z',
        baseline_window_end: '2025-12-31T23:59:59Z',
        sample_size: pattern.sample_size,
        distinct_companies: pattern.distinct_companies,
        distinct_funds: pattern.distinct_funds,
        qualifying_claim_ids: [],
        independent_source_count: pattern.independent_sources,
        coverage_metrics: { geographies: ['us', 'india', 'eu'], sectors: ['ai_infrastructure', 'ai_applications'] },
        sensitivity: {},
        methodology_version: 'market-trend-v1',
        input_fingerprint: fp,
        status: 'published',
        source_links: ['https://techcrunch.com', 'https://crunchbase.com', 'https://pitchbook.com'],
        filter_dimensions: { investment_stage: ['seed', 'series_a', 'series_b', 'series_c'], ai_tags: ['foundation_models', 'infrastructure', 'applications'] },
        publication_reason: 'Meets publication threshold with multiple independent sources',
      }, { onConflict: 'input_fingerprint' })
      .select('id')
      .single();

    if (patternRecord) {
      const { data: claim } = await supabase
        .from('claims')
        .insert({
          subject_type: 'pattern',
          subject_id: patternRecord.id,
          claim_type: 'other',
          predicate: 'pattern_observation',
          value_json: { name: pattern.name, description: pattern.description },
          effective_at: new Date().toISOString(),
          extraction_confidence: 0.9,
          resolution_confidence: 0.9,
          publication_status: 'published',
          model_run_id: (await supabase.from('model_runs').select('id').limit(1).single()).data?.id,
          published_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (claim) {
        await supabase.from('claim_evidence').insert({
          claim_id: claim.id,
          document_version_id: (await supabase.from('document_versions').select('id').limit(1).single()).data?.id,
          stance: 'supports',
          span_start: 0,
          span_end: 100,
          excerpt: pattern.description,
          excerpt_checksum: sha256(pattern.description),
          extractor_confidence: 0.9,
        });
        await supabase.from('pattern_citations').insert({
          pattern_id: patternRecord.id,
          claim_id: claim.id,
          claim_evidence_id: (await supabase.from('claim_evidence').select('id').eq('claim_id', claim.id).single()).data?.id,
          stance: 'supports',
        });
        console.log(`Created pattern: ${pattern.name}`);
      }
    }
  }

  // ============================================
  // STEP 6: Create YC batch companies (more)
  // ============================================
  console.log('\n--- Creating YC batch companies ---');
  
  const ycCompanies = [
    { batch: 'W26', companies: ['Poolside', 'Magic', 'Cognition', 'Factory', 'Anysphere', 'Granola', 'Limitless'] },
    { batch: 'S26', companies: ['Adept', 'Inflection AI', 'Character.ai', 'Imbue', 'Together AI', 'Fireworks AI'] },
    { batch: 'W25', companies: ['LangChain', 'Replit', 'Vercel', 'Linear', 'Notion', 'Tabnine'] },
  ];

  for (const yc of ycCompanies) {
    for (const companyName of yc.companies) {
      const companyId = companyMap.get(companyName);
      if (!companyId) continue;

      await supabase.from('yc_batch_companies').upsert({
        batch_id: yc.batch,
        company_id: companyId,
        is_ai_company: true,
      }, { onConflict: 'batch_id,company_id' });
    }
    // Update batch count
    await supabase.rpc('update_yc_batch_ai_count', { batch_id_param: yc.batch });
    console.log(`Linked ${yc.companies.length} companies to ${yc.batch}`);
  }

  console.log('\n=== Seeding Complete ===');
  console.log('Database now has rich data for reports and dashboard.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const MOCK_COMPANIES = [
  {
    id: 'openai',
    canonical_name: 'OpenAI',
    canonical_domain: 'openai.com',
    short_description: 'Building safe AGI. Creator of GPT-4, ChatGPT, DALL·E, Sora.',
    ai_tags: ['foundation_models'],
    hq_city: 'San Francisco',
    hq_country: 'US',
    stage: 'growth',
    latest_round_date: '2024-10-02',
    latest_round_amount_usd: 6600000000,
    latest_round_stage: 'series_b',
    lead_investors: ['Sequoia Capital', 'Thrive Capital'],
    yc_batch: null,
    source_links: ['https://openai.com/blog', 'https://techcrunch.com/tag/openai'],
    last_verified_at: new Date().toISOString(),
    verification_status: 'verified',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: new Date().toISOString(),
  },
  {
    id: 'anthropic',
    canonical_name: 'Anthropic',
    canonical_domain: 'anthropic.com',
    short_description: 'AI safety and research company. Creator of Claude.',
    ai_tags: ['foundation_models'],
    hq_city: 'San Francisco',
    hq_country: 'US',
    stage: 'growth',
    latest_round_date: '2024-03-15',
    latest_round_amount_usd: 4000000000,
    latest_round_stage: 'series_c',
    lead_investors: ['Amazon'],
    yc_batch: null,
    source_links: ['https://anthropic.com/news', 'https://techcrunch.com/tag/anthropic'],
    last_verified_at: new Date().toISOString(),
    verification_status: 'verified',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: new Date().toISOString(),
  },
  {
    id: 'mistral',
    canonical_name: 'Mistral AI',
    canonical_domain: 'mistral.ai',
    short_description: 'Open-weight foundation models. Apache 2.0 license.',
    ai_tags: ['foundation_models'],
    hq_city: 'Paris',
    hq_country: 'FR',
    stage: 'series_b',
    latest_round_date: '2024-06-15',
    latest_round_amount_usd: 640000000,
    latest_round_stage: 'series_b',
    lead_investors: ['General Catalyst', 'Lightspeed'],
    yc_batch: null,
    source_links: ['https://mistral.ai/news', 'https://techcrunch.com/tag/mistral-ai'],
    last_verified_at: new Date().toISOString(),
    verification_status: 'verified',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: new Date().toISOString(),
  },
  {
    id: 'figure',
    canonical_name: 'Figure AI',
    canonical_domain: 'figure.ai',
    short_description: 'Humanoid robotics company building Figure 01.',
    ai_tags: ['robotics'],
    hq_city: 'Sunnyvale',
    hq_country: 'US',
    stage: 'series_b',
    latest_round_date: '2024-02-15',
    latest_round_amount_usd: 675000000,
    latest_round_stage: 'series_b',
    lead_investors: ['Microsoft', 'OpenAI'],
    yc_batch: null,
    source_links: ['https://figure.ai/blog', 'https://techcrunch.com/tag/figure-ai'],
    last_verified_at: new Date().toISOString(),
    verification_status: 'verified',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: new Date().toISOString(),
  },
  {
    id: 'sarvam',
    canonical_name: 'Sarvam AI',
    canonical_domain: 'sarvam.ai',
    short_description: 'Building sovereign AI for India. OpenHathi Hindi LLM.',
    ai_tags: ['foundation_models'],
    hq_city: 'Bengaluru',
    hq_country: 'IN',
    stage: 'series_a',
    latest_round_date: '2023-12-15',
    latest_round_amount_usd: 41000000,
    latest_round_stage: 'series_a',
    lead_investors: ['Lightspeed', 'Peak XV'],
    yc_batch: null,
    source_links: ['https://sarvam.ai/blog'],
    last_verified_at: new Date().toISOString(),
    verification_status: 'verified',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: new Date().toISOString(),
  },
];

const MOCK_FUNDS = [
  {
    id: 'sequoia',
    canonical_name: 'Sequoia Capital',
    canonical_domain: 'sequoiacap.com',
    firm_type: 'vc_firm',
    hq_city: 'Menlo Park',
    hq_country: 'US',
    fund_vehicles: [
      { name: 'Sequoia Capital US', vintage_year: 2023, size_usd: 8000000000 },
      { name: 'Peak XV Partners', vintage_year: 2023, size_usd: 2500000000 },
    ],
    stated_thesis_excerpts: [
      { text: 'AI: A New Era — Infrastructure → Middleware → Applications', source_url: 'https://sequoiacap.com/blog/ai-new-era', source_type: 'blog', date_stated: '2023-09-15' },
      { text: 'Generative AI Market Map: Foundation models, dev tools, vertical apps', source_url: 'https://sequoiacap.com/blog/generative-ai-market-map', source_type: 'blog', date_stated: '2024-01-10' },
    ],
    observed_thesis: {
      methodology: 'Portfolio clustering (2023-2024), n=47 AI deals',
      period_start: '2023-01-01',
      period_end: '2024-10-01',
      sample_size: 47,
      themes: [
        { theme: 'Foundation Models', company_count: 15, deal_count: 18, percentage: 32 },
        { theme: 'AI Infrastructure', company_count: 12, deal_count: 14, percentage: 28 },
        { theme: 'Vertical Applications', company_count: 10, deal_count: 11, percentage: 24 },
        { theme: 'Robotics/Hardware', company_count: 6, deal_count: 7, percentage: 16 },
      ],
      confidence: 'high',
      caveats: 'Heavy weighting by OpenAI/xAI deal sizes',
      last_computed: '2024-10-01',
    },
    portfolio_companies: ['openai', 'anthropic', 'mistral', 'figure', 'glean', 'harvey'],
    recent_investments: [
      { company_id: 'openai', company_name: 'OpenAI', announced_date: '2024-10-02', round_stage: 'series_b', amount_usd: 6600000000, investor_role: 'lead', source_urls: ['https://sequoiacap.com/blog/openai-series-b'] },
      { company_id: 'figure', company_name: 'Figure AI', announced_date: '2024-02-15', round_stage: 'series_b', amount_usd: 675000000, investor_role: 'participant', source_urls: ['https://techcrunch.com/2024/02/15/figure-ai'] },
      { company_id: 'mistral', company_name: 'Mistral AI', announced_date: '2024-06-15', round_stage: 'series_b', amount_usd: 640000000, investor_role: 'participant', source_urls: ['https://techcrunch.com/2024/06/15/mistral'] },
    ],
    ai_focus_areas: ['foundation_models', 'infrastructure', 'applications', 'robotics'],
    typical_stages: ['seed', 'series_a', 'series_b', 'growth'],
    typical_geographies: ['us', 'india', 'eu'],
    source_coverage: [
      { source_id: 'sequoia-capital-blog', last_fetched_at: new Date().toISOString(), fetch_success_rate: 1.0, unique_yield: 0.8 },
    ],
    source_links: ['https://sequoiacap.com/blog', 'https://sequoiacap.com/companies'],
    last_verified_at: new Date().toISOString(),
    verification_status: 'verified',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: new Date().toISOString(),
  },
  {
    id: 'a16z',
    canonical_name: 'Andreessen Horowitz',
    canonical_domain: 'a16z.com',
    firm_type: 'vc_firm',
    hq_city: 'Menlo Park',
    hq_country: 'US',
    fund_vehicles: [
      { name: 'a16z Early Stage', vintage_year: 2024, size_usd: 3000000000 },
      { name: 'a16z Growth', vintage_year: 2023, size_usd: 5000000000 },
    ],
    stated_thesis_excerpts: [
      { text: 'The AI Infrastructure Stack: Compute, Data, Orchestration, Evals', source_url: 'https://a16z.com/ai-infrastructure-stack', source_type: 'blog', date_stated: '2024-03-01' },
      { text: 'AI Applications will be vertical, not horizontal', source_url: 'https://a16z.com/ai-apps-vertical', source_type: 'podcast', date_stated: '2024-02-15' },
    ],
    observed_thesis: {
      methodology: 'Portfolio clustering (2023-2024), n=52 AI deals',
      period_start: '2023-01-01',
      period_end: '2024-10-01',
      sample_size: 52,
      themes: [
        { theme: 'Infrastructure/DevTools', company_count: 18, deal_count: 20, percentage: 35 },
        { theme: 'Vertical Applications', company_count: 15, deal_count: 17, percentage: 29 },
        { theme: 'Foundation Models', company_count: 10, deal_count: 11, percentage: 21 },
        { theme: 'Consumer AI', company_count: 8, deal_count: 9, percentage: 15 },
      ],
      confidence: 'high',
      caveats: 'Broad thesis across multiple funds',
      last_computed: '2024-10-01',
    },
    portfolio_companies: ['anthropic', 'mistral', 'cohere', 'character', 'replicate', 'modal'],
    recent_investments: [
      { company_id: 'anthropic', company_name: 'Anthropic', announced_date: '2024-03-15', round_stage: 'series_c', amount_usd: 4000000000, investor_role: 'participant', source_urls: ['https://a16z.com/anthropic'] },
      { company_id: 'mistral', company_name: 'Mistral AI', announced_date: '2024-06-15', round_stage: 'series_b', amount_usd: 640000000, investor_role: 'lead', source_urls: ['https://a16z.com/mistral'] },
    ],
    ai_focus_areas: ['infrastructure', 'applications', 'foundation_models', 'consumer'],
    typical_stages: ['pre_seed', 'seed', 'series_a', 'series_b', 'growth'],
    typical_geographies: ['us', 'eu', 'global'],
    source_coverage: [
      { source_id: 'a16z-blog', last_fetched_at: new Date().toISOString(), fetch_success_rate: 1.0, unique_yield: 0.85 },
    ],
    source_links: ['https://a16z.com/portfolio', 'https://a16z.com/blog'],
    last_verified_at: new Date().toISOString(),
    verification_status: 'verified',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: new Date().toISOString(),
  },
  {
    id: 'peak-xv',
    canonical_name: 'Peak XV Partners',
    canonical_domain: 'peakxv.com',
    firm_type: 'vc_firm',
    hq_city: 'Bengaluru',
    hq_country: 'IN',
    fund_vehicles: [
      { name: 'Peak XV Fund I', vintage_year: 2023, size_usd: 2500000000 },
      { name: 'Surge', vintage_year: 2024, size_usd: 500000000 },
    ],
    stated_thesis_excerpts: [
      { text: 'AI in India: SaaS + AI applications, consumer AI', source_url: 'https://peakxv.com/blog/ai-india', source_type: 'blog', date_stated: '2024-01-20' },
    ],
    observed_thesis: {
      methodology: 'Portfolio clustering (2023-2024), n=28 AI deals',
      period_start: '2023-01-01',
      period_end: '2024-10-01',
      sample_size: 28,
      themes: [
        { theme: 'Vertical AI SaaS', company_count: 12, deal_count: 14, percentage: 43 },
        { theme: 'Consumer AI', company_count: 8, deal_count: 9, percentage: 32 },
        { theme: 'Foundation Models (Indic)', company_count: 4, deal_count: 4, percentage: 14 },
        { theme: 'AI Infrastructure', company_count: 3, deal_count: 3, percentage: 11 },
      ],
      confidence: 'medium',
      caveats: 'Smaller sample size, early fund',
      last_computed: '2024-10-01',
    },
    portfolio_companies: ['sarvam', 'krutrim', 'yellow-ai', 'observe-ai'],
    recent_investments: [
      { company_id: 'sarvam', company_name: 'Sarvam AI', announced_date: '2023-12-15', round_stage: 'series_a', amount_usd: 41000000, investor_role: 'lead', source_urls: ['https://peakxv.com/sarvam'] },
    ],
    ai_focus_areas: ['applications', 'foundation_models', 'infrastructure'],
    typical_stages: ['seed', 'series_a', 'series_b'],
    typical_geographies: ['india', 'us', 'global'],
    source_coverage: [
      { source_id: 'peak-xv-blog', last_fetched_at: new Date().toISOString(), fetch_success_rate: 1.0, unique_yield: 0.75 },
    ],
    source_links: ['https://peakxv.com/portfolio', 'https://peakxv.com/blog'],
    last_verified_at: new Date().toISOString(),
    verification_status: 'verified',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: new Date().toISOString(),
  },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const id = searchParams.get('id');
  const query = searchParams.get('q');

  if (type === 'company') {
    if (id) {
      const company = MOCK_COMPANIES.find(c => c.id === id);
      if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ company });
    }
    if (query) {
      const filtered = MOCK_COMPANIES.filter(c => 
        c.canonical_name.toLowerCase().includes(query.toLowerCase()) ||
        c.ai_tags.some(t => t.includes(query.toLowerCase()))
      );
      return NextResponse.json({ companies: filtered });
    }
    return NextResponse.json({ companies: MOCK_COMPANIES });
  }

  if (type === 'fund') {
    if (id) {
      const fund = MOCK_FUNDS.find(f => f.id === id);
      if (!fund) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ fund });
    }
    if (query) {
      const filtered = MOCK_FUNDS.filter(f => 
        f.canonical_name.toLowerCase().includes(query.toLowerCase()) ||
        f.ai_focus_areas.some(t => t.includes(query.toLowerCase()))
      );
      return NextResponse.json({ funds: filtered });
    }
    return NextResponse.json({ funds: MOCK_FUNDS });
  }

  return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
}
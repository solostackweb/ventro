import type { StoryCompany, StoryInvestor } from '@/types';

type NamedRelation = { canonical_name?: string | null } | { canonical_name?: string | null }[] | null;

interface RawCompanyLink {
  company_id: string;
  role: StoryCompany['role'];
  companies?: NamedRelation;
}

interface RawInvestorLink {
  fund_id: string;
  role: StoryInvestor['role'];
  funds?: NamedRelation;
}

function relationName(relation: NamedRelation | undefined): string {
  const entity = Array.isArray(relation) ? relation[0] : relation;
  return entity?.canonical_name || 'Unknown';
}

export function normalizeStory<T extends {
  story_companies?: RawCompanyLink[] | null;
  story_investors?: RawInvestorLink[] | null;
  story_sources?: Array<{ source_url: string }> | null;
  source_urls?: string[] | null;
  canonical_url?: string | null;
  publisher?: string | null;
  last_checked_at?: string | null;
  created_at?: string | null;
  ai_topics?: unknown;
}>(raw: T) {
  const sourceUrls = [...new Set([
    ...(Array.isArray(raw.source_urls) ? raw.source_urls : []),
    raw.canonical_url,
  ].filter((url): url is string => typeof url === 'string' && /^https?:\/\//i.test(url)))];
  const storySources = Array.isArray(raw.story_sources) && raw.story_sources.length > 0
    ? raw.story_sources
    : sourceUrls.map((source_url) => ({
        id: source_url,
        source_url,
        publisher: raw.publisher ?? null,
        published_at: null,
        fetched_at: raw.last_checked_at ?? raw.created_at ?? '',
        content_hash: null,
        supports_claims: null,
      }));
  return {
    ...raw,
    ...(Object.prototype.hasOwnProperty.call(raw, 'story_sources') ? { story_sources: storySources } : {}),
    ai_topics: Array.isArray(raw.ai_topics) ? raw.ai_topics : [],
    companies: (Array.isArray(raw.story_companies) ? raw.story_companies : []).map((link) => ({
      company_id: link.company_id,
      name: relationName(link.companies),
      role: link.role,
    })),
    investors: (Array.isArray(raw.story_investors) ? raw.story_investors : []).map((link) => ({
      fund_id: link.fund_id,
      name: relationName(link.funds),
      role: link.role,
    })),
  };
}

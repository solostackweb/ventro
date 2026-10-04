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
  ai_topics?: unknown;
}>(raw: T) {
  return {
    ...raw,
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

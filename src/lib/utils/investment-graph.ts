interface InvestmentGraphRow {
  round_id: string;
  company_id: string;
  company_name: string;
  company_domain: string | null;
  company_ai_tags: string[] | null;
  company_country: string | null;
  yc_batch: string | null;
  announced_date: string;
  round_stage: string | null;
  amount_usd: number | null;
  amount_currency: string | null;
  round_verification: string;
  fund_id: string | null;
  fund_name: string | null;
  firm_type: string | null;
  fund_vehicle_id: string | null;
  vehicle_name: string | null;
  vintage_year: number | null;
  participant_role: string | null;
  participant_verification: string | null;
  participant_sources: string[] | null;
  round_sources: string[] | null;
}

export function mapInvestmentGraphRow(row: InvestmentGraphRow) {
  return {
    id: `${row.round_id}:${row.fund_id ?? 'undisclosed'}:${row.fund_vehicle_id ?? 'firm'}`,
    round_id: row.round_id,
    fund_id: row.fund_id,
    fund_vehicle_id: row.fund_vehicle_id,
    company_id: row.company_id,
    company_name: row.company_name,
    announced_date: row.announced_date,
    round_stage: row.round_stage,
    amount_usd: row.amount_usd,
    amount_currency: row.amount_currency ?? 'USD',
    investor_role: row.participant_role ?? 'undisclosed',
    source_urls: [...new Set([...(row.round_sources ?? []), ...(row.participant_sources ?? [])].filter(Boolean))],
    verification_status: row.round_verification === 'verified' && (!row.fund_id || row.participant_verification === 'verified')
      ? 'verified' : 'partial',
    conflicts: [],
    companies: {
      id: row.company_id,
      canonical_name: row.company_name,
      canonical_domain: row.company_domain,
      ai_tags: row.company_ai_tags ?? [],
      hq_city: null,
      hq_country: row.company_country,
      stage: null,
      yc_batch: row.yc_batch,
    },
    funds: row.fund_id ? {
      id: row.fund_id,
      canonical_name: row.fund_name ?? 'Unknown Fund',
      canonical_domain: null,
      firm_type: row.firm_type,
      hq_city: null,
      hq_country: null,
    } : null,
    fund_vehicles: row.fund_vehicle_id ? {
      id: row.fund_vehicle_id,
      name: row.vehicle_name ?? 'Unnamed vehicle',
      vintage_year: row.vintage_year,
      size_usd: null,
      focus: null,
    } : null,
  };
}

export function summarizeVisibleInvestments(rows: Array<{ id: string; round_id?: string; company_id: string; amount_usd: number | null; verification_status: string }>) {
  const rounds = new Map(rows.map((row) => [row.round_id ?? row.id, row]));
  return {
    verifiedParticipations: rows.filter((row) => row.verification_status === 'verified').length,
    disclosedRoundValueUsd: [...rounds.values()].reduce((sum, row) => sum + (row.amount_usd ?? 0), 0),
    uniqueCompanies: new Set(rows.map((row) => row.company_id)).size,
  };
}

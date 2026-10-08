import { classifyYcAiTags, extractPortfolioCandidates, normalizeYcBatch, parseYcAlgoliaConfig } from '@/lib/ingestion/entity-sync';
import { classifyKnownInvestorRole, inferFundedCompanyName } from '@/lib/ingestion/funding-extractor';

describe('structured entity synchronization', () => {
  test('parses YC public directory configuration without hardcoding credentials', () => {
    expect(parseYcAlgoliaConfig('<script>window.AlgoliaOpts = {"app":"APP1","key":"public-key"};</script>'))
      .toEqual({ app: 'APP1', key: 'public-key' });
  });

  test.each([
    ['Winter 2026', { id: 'W26', season: 'W', year: 2026 }],
    ['Spring 2026', { id: 'P26', season: 'P', year: 2026 }],
    ['Summer 2025', { id: 'S25', season: 'S', year: 2025 }],
    ['Fall 2025', { id: 'F25', season: 'F', year: 2025 }],
  ])('normalizes current YC batch %s', (input, expected) => {
    expect(normalizeYcBatch(input)).toMatchObject(expected);
  });

  test('classifies AI companies conservatively', () => {
    expect(classifyYcAiTags({ name: 'ModelCo', one_liner: 'Foundation models for clinical AI' }))
      .toEqual(expect.arrayContaining(['foundation_models']));
    expect(classifyYcAiTags({ name: 'CoffeeCo', one_liner: 'Coffee delivered weekly' })).toEqual([]);
  });

  test('accepts only portfolio names grounded in returned markdown', () => {
    const candidates = extractPortfolioCandidates({
      markdown: 'Our companies include [Acme AI](https://acme.ai) and Nova Labs.',
      json: { companies: [{ name: 'Acme AI', website: 'https://acme.ai' }, { name: 'Hallucinated Co', website: 'https://fake.test' }] },
    }, 'https://fund.example/portfolio');
    expect(candidates.map(item => item.name)).toEqual(['Acme AI']);
  });
});

describe('funding extraction discovery', () => {
  test.each([
    ['Acme AI raises $20M Series A', 'Acme AI'],
    ['Partnering with Corma: Closing the Cybersecurity Gap', 'Corma'],
  ])('infers the funded company from %s', (headline, expected) => {
    expect(inferFundedCompanyName(headline)).toBe(expected);
  });

  test('requires explicit investor-role language', () => {
    expect(classifyKnownInvestorRole('The $20M round was led by Sequoia Capital.', 'Sequoia Capital')).toBe('lead');
    expect(classifyKnownInvestorRole('with participation from Accel and others.', 'Accel')).toBe('participant');
    expect(classifyKnownInvestorRole('The founder previously worked with Accel.', 'Accel')).toBeNull();
  });
});

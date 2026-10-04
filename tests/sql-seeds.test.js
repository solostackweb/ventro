const fs = require('fs');
const path = require('path');

const COLUMNS = [
  'source_id', 'name', 'category', 'base_url', 'access_method', 'auth_required',
  'rate_limit', 'robots_txt_allows', 'terms_of_use_url', 'reuse_permission',
  'attribution_required', 'commercial_use_allowed', 'retention_max_days',
  'expected_fact_types', 'cadence', 'owner', 'status', 'last_audit_date', 'notes',
];

const ALLOWED_VALUES = {
  category: ['vc_blog', 'company_blog', 'news_aggregator', 'government', 'developer_platform', 'yc', 'search'],
  access_method: ['rss', 'api', 'html', 'sitemap', 'search'],
  auth_required: ['none', 'api_key', 'oauth', 'login'],
  robots_txt_allows: ['yes', 'no', 'conditional'],
  reuse_permission: ['full_text', 'summary_only', 'metadata_only', 'link_only', 'unknown'],
  commercial_use_allowed: ['yes', 'no', 'unclear'],
  cadence: ['realtime', 'hourly', 'daily', 'weekly', 'on_demand'],
  status: ['approved', 'pending_review', 'rejected', 'paused'],
};

function splitSqlValues(tuple) {
  const values = [];
  let current = '';
  let quoted = false;
  let bracketDepth = 0;

  for (let index = 0; index < tuple.length; index += 1) {
    const character = tuple[index];
    const next = tuple[index + 1];

    if (character === "'" && quoted && next === "'") {
      current += "''";
      index += 1;
      continue;
    }
    if (character === "'") quoted = !quoted;
    if (!quoted && character === '[') bracketDepth += 1;
    if (!quoted && character === ']') bracketDepth -= 1;

    if (!quoted && bracketDepth === 0 && character === ',') {
      values.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }

  values.push(current.trim());
  return values;
}

function parseConnectorRows(sql) {
  const valuesMarker = /\)\s*VALUES/i.exec(sql);
  if (!valuesMarker) throw new Error('Could not find source_connectors VALUES clause');

  const valuesStart = valuesMarker.index + valuesMarker[0].length;
  const valuesEnd = sql.indexOf(';', valuesStart);
  const valuesSection = sql.slice(valuesStart, valuesEnd).replace(/--.*$/gm, '');
  const tuples = [];
  let start = -1;
  let depth = 0;
  let quoted = false;

  for (let index = 0; index < valuesSection.length; index += 1) {
    const character = valuesSection[index];
    const next = valuesSection[index + 1];

    if (character === "'" && quoted && next === "'") {
      index += 1;
      continue;
    }
    if (character === "'") quoted = !quoted;
    if (quoted) continue;

    if (character === '(') {
      if (depth === 0) start = index + 1;
      depth += 1;
    } else if (character === ')') {
      depth -= 1;
      if (depth === 0 && start >= 0) tuples.push(valuesSection.slice(start, index));
    }
  }

  return tuples.map((tuple) => Object.fromEntries(
    splitSqlValues(tuple).map((value, index) => [COLUMNS[index], value.replace(/^'|'$/g, '')])
  ));
}

describe('source connector seed', () => {
  const seedPath = path.resolve(__dirname, '../supabase/seed_source_connectors.sql');
  const rows = parseConnectorRows(fs.readFileSync(seedPath, 'utf8'));

  it('contains complete rows', () => {
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => expect(Object.keys(row)).toHaveLength(COLUMNS.length));
  });

  it.each(Object.entries(ALLOWED_VALUES))('%s values satisfy the schema constraint', (column, allowed) => {
    rows.forEach((row) => {
      expect(allowed).toContain(row[column]);
    });
  });
});

describe('YC batch seed', () => {
  const sql = fs.readFileSync(path.resolve(__dirname, '../supabase/seed_yc_batches.sql'), 'utf8');

  it('can be rerun without replacing existing batches or duplicate company links', () => {
    const batches = sql.match(/INSERT INTO yc_batches[\s\S]*?;/i);
    expect(batches).not.toBeNull();
    expect(batches[0]).toMatch(/ON CONFLICT DO NOTHING\s*;/i);
    const links = sql.match(/INSERT INTO yc_batch_companies[\s\S]*?;/gi) || [];
    expect(links).toHaveLength(9);
    links.forEach((statement) => {
      expect(statement).toMatch(/ON CONFLICT \(batch_id, company_id\) DO NOTHING\s*;/i);
    });
  });
});

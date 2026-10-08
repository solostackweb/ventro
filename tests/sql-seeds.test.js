const fs = require('fs');
const path = require('path');

const COLUMNS = [
  'source_id', 'name', 'category', 'base_url', 'access_method', 'auth_required',
  'rate_limit', 'robots_txt_allows', 'terms_of_use_url', 'reuse_permission',
  'attribution_required', 'commercial_use_allowed', 'retention_max_days',
  'expected_fact_types', 'cadence', 'owner', 'status', 'last_audit_date', 'notes',
];

const ALLOWED_VALUES = {
  category: ['vc_blog', 'corporate', 'company_blog', 'news_aggregator', 'government', 'developer_platform', 'yc', 'search'],
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

function parseSqlTuples(valuesSection) {
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

  return tuples;
}

function findUnquotedSemicolon(sql, start) {
  let quoted = false;

  for (let index = start; index < sql.length; index += 1) {
    const character = sql[index];
    const next = sql[index + 1];

    if (character === "'" && quoted && next === "'") {
      index += 1;
      continue;
    }
    if (character === "'") quoted = !quoted;
    if (!quoted && character === ';') return index;
  }

  throw new Error('Could not find end of source_connectors INSERT statement');
}

function parseConnectorRows(sql) {
  const valuesMarker = /\)\s*VALUES/i.exec(sql);
  if (!valuesMarker) throw new Error('Could not find source_connectors VALUES clause');

  const valuesStart = valuesMarker.index + valuesMarker[0].length;
  const valuesEnd = findUnquotedSemicolon(sql, valuesStart);
  const valuesSection = sql
    .slice(valuesStart, valuesEnd)
    .replace(/--.*$/gm, '')
    .replace(/\s+ON CONFLICT[\s\S]*$/i, '');
  const tuples = parseSqlTuples(valuesSection);

  return tuples.map((tuple) => Object.fromEntries(
    splitSqlValues(tuple).map((value, index) => [COLUMNS[index], value.replace(/^'|'$/g, '')])
  ));
}

describe('source connector seed', () => {
  const seedPaths = [
    path.resolve(__dirname, '../supabase/seed_source_connectors.sql'),
    path.resolve(__dirname, '../supabase/seed_source_connectors_extended.sql'),
  ];
  const rows = seedPaths.flatMap((seedPath) => parseConnectorRows(fs.readFileSync(seedPath, 'utf8')));

  it('contains complete rows', () => {
    expect(rows).toHaveLength(69);
    rows.forEach((row) => expect(Object.keys(row)).toHaveLength(COLUMNS.length));
  });

  it.each(Object.entries(ALLOWED_VALUES))('%s values satisfy the schema constraint', (column, allowed) => {
    rows.forEach((row) => {
      expect(allowed).toContain(row[column]);
    });
  });

  it('allows every seeded category in the final hosted schema', () => {
    const migration = fs.readFileSync(
      path.resolve(__dirname, '../supabase/migrations/20261008040000_align_source_connector_categories.sql'),
      'utf8'
    );
    const seededCategories = [...new Set(rows.map((row) => row.category))];

    seededCategories.forEach((category) => expect(migration).toContain(`'${category}'`));
  });
});

describe('company seed', () => {
  const sql = fs.readFileSync(path.resolve(__dirname, '../supabase/seed_companies.sql'), 'utf8');
  const allowedStages = [
    'pre_seed', 'seed', 'series_a', 'series_b', 'series_c', 'series_d', 'series_e',
    'growth', 'public', 'ipo', 'acquisition', 'grant', 'debt', 'convertible', 'safe', 'other',
  ];

  it('uses only canonical stage values accepted by the final schema', () => {
    const statements = sql.match(/INSERT INTO companies[\s\S]*?;/gi) || [];
    expect(statements.length).toBeGreaterThan(0);

    for (const statement of statements) {
      const valuesMarker = /\)\s*VALUES/i.exec(statement);
      expect(valuesMarker).not.toBeNull();
      const valuesSection = statement.slice(valuesMarker.index + valuesMarker[0].length, -1);

      for (const tuple of parseSqlTuples(valuesSection)) {
        const values = splitSqlValues(tuple).map((value) => value.replace(/^'|'$/g, ''));
        if (values[6].toUpperCase() !== 'NULL') expect(allowedStages).toContain(values[6]);
        if (values[9].toUpperCase() !== 'NULL') expect(allowedStages).toContain(values[9]);
      }
    }
  });

  it('widens the legacy company constraints before hosted seeds run', () => {
    const migration = fs.readFileSync(
      path.resolve(__dirname, '../supabase/migrations/20261008030000_align_company_stage_constraints.sql'),
      'utf8'
    );

    expect(migration).toMatch(/companies_latest_round_stage_check[\s\S]*?'series_d'[\s\S]*?'series_e'/i);
    expect(migration).toMatch(/ALTER TABLE public\.investments[\s\S]*?investments_round_stage_check[\s\S]*?'series_d'[\s\S]*?'series_e'/i);
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

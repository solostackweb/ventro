const fs = require('fs');
const path = require('path');

describe('story detail source contract', () => {
  it('queries only relationships present in the schema', () => {
    const route = fs.readFileSync(
      path.resolve(__dirname, '../src/app/api/stories/[id]/route.ts'),
      'utf8'
    );
    const schema = fs.readFileSync(
      path.resolve(__dirname, '../supabase/schema.sql'),
      'utf8'
    );

    expect(route).toMatch(/story_sources\s*\(/);
    expect(route).not.toMatch(/source_connectors!inner/);
    expect(schema).toMatch(/CREATE TABLE story_sources\s*\(/);
    expect(schema).not.toMatch(/source_id\s+TEXT[^\n]*REFERENCES source_connectors\(source_id\)[\s\S]*?UNIQUE\(story_id, source_url\)/);
  });

  it('retains a visible source label when publisher is absent', () => {
    const page = fs.readFileSync(
      path.resolve(__dirname, '../src/app/(dashboard)/news/[id]/page.tsx'),
      'utf8'
    );
    expect(page).toMatch(/new URL\(source\.source_url\)\.hostname/);
    expect(page).not.toMatch(/source\.source_connectors/);
  });
});

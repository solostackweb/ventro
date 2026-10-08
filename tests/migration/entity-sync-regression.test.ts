import { readFileSync } from 'fs';
import { resolve } from 'path';

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261009010000_entity_sync_and_round_visibility.sql'), 'utf8');

describe('entity sync and round visibility migration', () => {
  test('adds the hosted entity pipeline and all four YC seasons', () => {
    expect(sql).toContain("ADD VALUE IF NOT EXISTS 'entity_sync'");
    expect(sql).toContain("season IN ('W', 'P', 'S', 'F')");
  });

  test('keeps portfolio provenance visible under RLS', () => {
    expect(sql).toContain('source_url TEXT');
    expect(sql).toContain('Public can view fund portfolio');
  });

  test('does not hide a round when its investor is undisclosed', () => {
    expect(sql).toMatch(/LEFT JOIN public\.round_participants rp/);
    expect(sql).not.toMatch(/WHERE[\s\S]*AND rp\.verification_status/);
  });
});

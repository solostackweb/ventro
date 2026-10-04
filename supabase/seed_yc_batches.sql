-- Ventro Seed Data: YC Batches and Companies
-- Run after schema.sql and seed_companies.sql in Supabase SQL Editor
-- Based on phase0/03-50-ai-companies.md YC AI Companies section

-- ============================================
-- YC Batches
-- ============================================

INSERT INTO yc_batches (id, batch_name, season, year, demo_day_date, total_companies, ai_companies_count, source_links, created_at, updated_at) VALUES
('W20', 'Winter 2020', 'W', 2020, '2020-03-15', 200, 15, ARRAY['https://www.ycombinator.com/companies?batch=W20'], NOW(), NOW()),
('S20', 'Summer 2020', 'S', 2020, '2020-08-15', 220, 18, ARRAY['https://www.ycombinator.com/companies?batch=S20'], NOW(), NOW()),
('W21', 'Winter 2021', 'W', 2021, '2021-03-15', 350, 25, ARRAY['https://www.ycombinator.com/companies?batch=W21'], NOW(), NOW()),
('S21', 'Summer 2021', 'S', 2021, '2021-08-15', 380, 30, ARRAY['https://www.ycombinator.com/companies?batch=S21'], NOW(), NOW()),
('W22', 'Winter 2022', 'W', 2022, '2022-03-15', 400, 35, ARRAY['https://www.ycombinator.com/companies?batch=W22'], NOW(), NOW()),
('S22', 'Summer 2022', 'S', 2022, '2022-08-15', 420, 40, ARRAY['https://www.ycombinator.com/companies?batch=S22'], NOW(), NOW()),
('W23', 'Winter 2023', 'W', 2023, '2023-03-15', 250, 45, ARRAY['https://www.ycombinator.com/companies?batch=W23'], NOW(), NOW()),
('S23', 'Summer 2023', 'S', 2023, '2023-08-15', 280, 50, ARRAY['https://www.ycombinator.com/companies?batch=S23'], NOW(), NOW()),
('W24', 'Winter 2024', 'W', 2024, '2024-03-15', 260, 55, ARRAY['https://www.ycombinator.com/companies?batch=W24'], NOW(), NOW()),
('S24', 'Summer 2024', 'S', 2024, '2024-08-15', 270, 60, ARRAY['https://www.ycombinator.com/companies?batch=S24'], NOW(), NOW()),
('W25', 'Winter 2025', 'W', 2025, '2025-03-15', 250, 65, ARRAY['https://www.ycombinator.com/companies?batch=W25'], NOW(), NOW()),
('S25', 'Summer 2025 (in progress)', 'S', 2025, '2025-08-15', 250, 70, ARRAY['https://www.ycombinator.com/companies?batch=S25'], NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ============================================
-- YC Batch Companies (linking to existing companies)
-- Note: These link to companies already seeded in seed_companies.sql
-- ============================================

-- Modal (S23) - already in companies
INSERT INTO yc_batch_companies (batch_id, company_id, is_ai_company, created_at)
SELECT 'S23', id, true, NOW() FROM companies WHERE canonical_name = 'Modal'
ON CONFLICT (batch_id, company_id) DO NOTHING;

-- Replicate (W20) - already in companies  
INSERT INTO yc_batch_companies (batch_id, company_id, is_ai_company, created_at)
SELECT 'W20', id, true, NOW() FROM companies WHERE canonical_name = 'Replicate'
ON CONFLICT (batch_id, company_id) DO NOTHING;

-- Baseten (W21) - already in companies
INSERT INTO yc_batch_companies (batch_id, company_id, is_ai_company, created_at)
SELECT 'W21', id, true, NOW() FROM companies WHERE canonical_name = 'Baseten'
ON CONFLICT (batch_id, company_id) DO NOTHING;

-- Parea AI (S24) - need to add to companies first
INSERT INTO companies (canonical_name, canonical_domain, short_description, ai_tags, hq_city, hq_country, stage, yc_batch, source_links, last_verified_at, verification_status)
VALUES ('Parea AI', 'parea.ai', 'LLM evaluation and observability platform for production AI', ARRAY['infrastructure', 'applications'], 'San Francisco', 'us', 'seed', 'S24', ARRAY['https://parea.ai', 'https://parea.ai/blog'], NOW(), 'unverified')
ON CONFLICT DO NOTHING;

INSERT INTO yc_batch_companies (batch_id, company_id, is_ai_company, created_at)
SELECT 'S24', id, true, NOW() FROM companies WHERE canonical_name = 'Parea AI'
ON CONFLICT (batch_id, company_id) DO NOTHING;

-- Martian (S24) - need to add
INSERT INTO companies (canonical_name, canonical_domain, short_description, ai_tags, hq_city, hq_country, stage, yc_batch, source_links, last_verified_at, verification_status)
VALUES ('Martian', 'martian.ai', 'Model routing and optimization platform for LLM applications', ARRAY['infrastructure', 'applications'], 'San Francisco', 'us', 'seed', 'S24', ARRAY['https://martian.ai'], NOW(), 'unverified')
ON CONFLICT DO NOTHING;

INSERT INTO yc_batch_companies (batch_id, company_id, is_ai_company, created_at)
SELECT 'S24', id, true, NOW() FROM companies WHERE canonical_name = 'Martian'
ON CONFLICT (batch_id, company_id) DO NOTHING;

-- Vellum (S23/S24) - already in companies as S23
INSERT INTO yc_batch_companies (batch_id, company_id, is_ai_company, created_at)
SELECT 'S24', id, true, NOW() FROM companies WHERE canonical_name = 'Vellum'
ON CONFLICT (batch_id, company_id) DO NOTHING;

-- E2B (W24) - need to add
INSERT INTO companies (canonical_name, canonical_domain, short_description, ai_tags, hq_city, hq_country, stage, yc_batch, source_links, last_verified_at, verification_status)
VALUES ('E2B', 'e2b.dev', 'Code interpreter SDK for AI agents and LLM applications', ARRAY['infrastructure', 'applications'], 'San Francisco', 'us', 'seed', 'W24', ARRAY['https://e2b.dev'], NOW(), 'unverified')
ON CONFLICT DO NOTHING;

INSERT INTO yc_batch_companies (batch_id, company_id, is_ai_company, created_at)
SELECT 'W24', id, true, NOW() FROM companies WHERE canonical_name = 'E2B'
ON CONFLICT (batch_id, company_id) DO NOTHING;

-- Browserbase (W24) - need to add
INSERT INTO companies (canonical_name, canonical_domain, short_description, ai_tags, hq_city, hq_country, stage, yc_batch, source_links, last_verified_at, verification_status)
VALUES ('Browserbase', 'browserbase.com', 'Headless browser infrastructure for AI agents and web automation', ARRAY['infrastructure', 'applications'], 'San Francisco', 'us', 'seed', 'W24', ARRAY['https://browserbase.com'], NOW(), 'unverified')
ON CONFLICT DO NOTHING;

INSERT INTO yc_batch_companies (batch_id, company_id, is_ai_company, created_at)
SELECT 'W24', id, true, NOW() FROM companies WHERE canonical_name = 'Browserbase'
ON CONFLICT (batch_id, company_id) DO NOTHING;

-- Fixie (W24) - need to add
INSERT INTO companies (canonical_name, canonical_domain, short_description, ai_tags, hq_city, hq_country, stage, yc_batch, source_links, last_verified_at, verification_status)
VALUES ('Fixie', 'fixie.ai', 'AI agent platform for building conversational AI applications', ARRAY['applications', 'infrastructure'], 'San Francisco', 'us', 'seed', 'W24', ARRAY['https://fixie.ai'], NOW(), 'unverified')
ON CONFLICT DO NOTHING;

INSERT INTO yc_batch_companies (batch_id, company_id, is_ai_company, created_at)
SELECT 'W24', id, true, NOW() FROM companies WHERE canonical_name = 'Fixie'
ON CONFLICT (batch_id, company_id) DO NOTHING;

-- Update ai_companies_count for each batch based on actual linked companies
UPDATE yc_batches SET ai_companies_count = (
  SELECT COUNT(*) FROM yc_batch_companies WHERE batch_id = yc_batches.id AND is_ai_company = true
);

-- Verification
SELECT b.id, b.batch_name, b.ai_companies_count, COUNT(yc.company_id) as actual_count
FROM yc_batches b
LEFT JOIN yc_batch_companies yc ON yc.batch_id = b.id AND yc.is_ai_company = true
GROUP BY b.id
ORDER BY b.year DESC, b.season;

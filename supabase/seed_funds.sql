-- Ventro Seed Data: Funds (50 AI-Focused VCs)
-- Run after schema.sql in Supabase SQL Editor
-- Based on phase0/02-50-ai-vcs.md

-- ============================================
-- TIER 1: Multi-Stage / Global AI Leaders (12)
-- ============================================

INSERT INTO funds (canonical_name, canonical_domain, firm_type, hq_city, hq_country, source_links, last_verified_at, verification_status) VALUES
('Sequoia Capital', 'sequoiacap.com', 'vc_firm', 'Menlo Park', 'us', ARRAY['https://sequoiacap.com', 'https://sequoiacap.com/companies', 'https://sequoiacap.com/feed/'], NOW(), 'unverified'),
('Andreessen Horowitz', 'a16z.com', 'vc_firm', 'Menlo Park', 'us', ARRAY['https://a16z.com', 'https://a16z.com/portfolio', 'https://a16z.com/feed/'], NOW(), 'unverified'),
('Lightspeed Venture Partners', 'lsvp.com', 'vc_firm', 'Menlo Park', 'us', ARRAY['https://lsvp.com', 'https://lsvp.com/portfolio', 'https://lsvp.com/feed/'], NOW(), 'unverified'),
('Greylock Partners', 'greylock.com', 'vc_firm', 'Menlo Park', 'us', ARRAY['https://greylock.com', 'https://greylock.com/portfolio', 'https://greylock.com/feed/'], NOW(), 'unverified'),
('Index Ventures', 'indexventures.com', 'vc_firm', 'London', 'uk', ARRAY['https://indexventures.com', 'https://indexventures.com/portfolio', 'https://indexventures.com/feed/'], NOW(), 'unverified'),
('Coatue Management', 'coatue.com', 'vc_firm', 'New York', 'us', ARRAY['https://coatue.com', 'https://coatue.com/portfolio'], NOW(), 'unverified'),
('Tiger Global Management', 'tigerglobal.com', 'vc_firm', 'New York', 'us', ARRAY['https://tigerglobal.com', 'https://tigerglobal.com/portfolio'], NOW(), 'unverified'),
('Khosla Ventures', 'khoslaventures.com', 'vc_firm', 'Menlo Park', 'us', ARRAY['https://khoslaventures.com', 'https://khoslaventures.com/portfolio', 'https://khoslaventures.com/feed/'], NOW(), 'unverified'),
('General Catalyst', 'generalcatalyst.com', 'vc_firm', 'San Francisco', 'us', ARRAY['https://generalcatalyst.com', 'https://generalcatalyst.com/portfolio', 'https://generalcatalyst.com/feed/'], NOW(), 'unverified'),
('NVentures', 'nvidia.com', 'corporate', 'Santa Clara', 'us', ARRAY['https://nvidia.com/en-us/about-us/investments'], NOW(), 'unverified'),
('Microsoft M12', 'm12.vc', 'corporate', 'San Francisco', 'us', ARRAY['https://m12.vc', 'https://m12.vc/portfolio', 'https://m12.vc/feed/'], NOW(), 'unverified'),
('Google Ventures', 'gv.com', 'corporate', 'Mountain View', 'us', ARRAY['https://gv.com', 'https://gv.com/portfolio', 'https://gv.com/feed/'], NOW(), 'unverified');

-- Sequoia vehicles
WITH seq AS (SELECT id FROM funds WHERE canonical_name = 'Sequoia Capital')
INSERT INTO fund_vehicles (fund_id, name, vintage_year, size_usd, focus) SELECT id, 'Sequoia Capital US', 2023, 8000000000, 'Multi-stage global' FROM seq;

WITH seq AS (SELECT id FROM funds WHERE canonical_name = 'Sequoia Capital')
INSERT INTO fund_vehicles (fund_id, name, vintage_year, size_usd, focus) SELECT id, 'Sequoia India/SEA (Peak XV)', 2023, 2850000000, 'India & Southeast Asia' FROM seq;

WITH seq AS (SELECT id FROM funds WHERE canonical_name = 'Sequoia Capital')
INSERT INTO fund_vehicles (fund_id, name, vintage_year, size_usd, focus) SELECT id, 'Sequoia China (HongShan)', 2023, 5000000000, 'China' FROM seq;

-- a16z vehicles
WITH a16z AS (SELECT id FROM funds WHERE canonical_name = 'Andreessen Horowitz')
INSERT INTO fund_vehicles (fund_id, name, vintage_year, size_usd, focus) SELECT id, 'a16z Early Stage', 2024, 4000000000, 'Pre-seed to Series A' FROM a16z;

WITH a16z AS (SELECT id FROM funds WHERE canonical_name = 'Andreessen Horowitz')
INSERT INTO fund_vehicles (fund_id, name, vintage_year, size_usd, focus) SELECT id, 'a16z Growth', 2024, 6000000000, 'Series B+' FROM a16z;

WITH a16z AS (SELECT id FROM funds WHERE canonical_name = 'Andreessen Horowitz')
INSERT INTO fund_vehicles (fund_id, name, vintage_year, size_usd, focus) SELECT id, 'a16z Bio', 2024, 2000000000, 'Life sciences & bio AI' FROM a16z;

WITH a16z AS (SELECT id FROM funds WHERE canonical_name = 'Andreessen Horowitz')
INSERT INTO fund_vehicles (fund_id, name, vintage_year, size_usd, focus) SELECT id, 'a16z Crypto', 2024, 4500000000, 'Crypto & web3' FROM a16z;

WITH a16z AS (SELECT id FROM funds WHERE canonical_name = 'Andreessen Horowitz')
INSERT INTO fund_vehicles (fund_id, name, vintage_year, size_usd, focus) SELECT id, 'a16z Games', 2024, 600000000, 'Gaming & interactive media' FROM a16z;

-- Lightspeed vehicles
WITH ls AS (SELECT id FROM funds WHERE canonical_name = 'Lightspeed Venture Partners')
INSERT INTO fund_vehicles (fund_id, name, vintage_year, size_usd, focus) SELECT id, 'Lightspeed US', 2024, 3500000000, 'US multi-stage' FROM ls;

WITH ls AS (SELECT id FROM funds WHERE canonical_name = 'Lightspeed Venture Partners')
INSERT INTO fund_vehicles (fund_id, name, vintage_year, size_usd, focus) SELECT id, 'Lightspeed India', 2023, 1500000000, 'India & SEA' FROM ls;

WITH ls AS (SELECT id FROM funds WHERE canonical_name = 'Lightspeed Venture Partners')
INSERT INTO fund_vehicles (fund_id, name, vintage_year, size_usd, focus) SELECT id, 'Lightspeed China', 2022, 1200000000, 'China' FROM ls;

-- ============================================
-- TIER 2: AI-Specialist / Thesis-Driven Funds (14)
-- ============================================

INSERT INTO funds (canonical_name, canonical_domain, firm_type, hq_city, hq_country, source_links, last_verified_at, verification_status) VALUES
('Radical Ventures', 'radical.vc', 'vc_firm', 'Toronto', 'canada', ARRAY['https://radical.vc', 'https://radical.vc/portfolio', 'https://radical.vc/feed/'], NOW(), 'unverified'),
('Air Street Capital', 'airstreet.com', 'vc_firm', 'London', 'uk', ARRAY['https://airstreet.com', 'https://airstreet.com/portfolio', 'https://airstreet.com/feed/'], NOW(), 'unverified'),
('Zetta Venture Partners', 'zettavp.com', 'vc_firm', 'San Francisco', 'us', ARRAY['https://zettavp.com', 'https://zettavp.com/portfolio', 'https://zettavp.com/feed/'], NOW(), 'unverified'),
('Amplify Partners', 'amplify.com', 'vc_firm', 'San Francisco', 'us', ARRAY['https://amplify.com', 'https://amplify.com/portfolio', 'https://amplify.com/feed/'], NOW(), 'unverified'),
('Costanoa Ventures', 'costanoa.com', 'vc_firm', 'Palo Alto', 'us', ARRAY['https://costanoa.com', 'https://costanoa.com/portfolio', 'https://costanoa.com/feed/'], NOW(), 'unverified'),
('Wing Venture Capital', 'wing.vc', 'vc_firm', 'Palo Alto', 'us', ARRAY['https://wing.vc', 'https://wing.vc/portfolio', 'https://wing.vc/feed/'], NOW(), 'unverified'),
('Data Collective', 'dcvc.com', 'vc_firm', 'San Francisco', 'us', ARRAY['https://dcvc.com', 'https://dcvc.com/portfolio', 'https://dcvc.com/feed/'], NOW(), 'unverified'),
('Two Sigma Ventures', 'twosigmaventures.com', 'vc_firm', 'New York', 'us', ARRAY['https://twosigmaventures.com', 'https://twosigmaventures.com/portfolio', 'https://twosigmaventures.com/feed/'], NOW(), 'unverified'),
('IA Ventures', 'iaventures.com', 'vc_firm', 'New York', 'us', ARRAY['https://iaventures.com', 'https://iaventures.com/portfolio', 'https://iaventures.com/feed/'], NOW(), 'unverified'),
('Pillar VC', 'pillar.vc', 'vc_firm', 'Boston', 'us', ARRAY['https://pillar.vc', 'https://pillar.vc/portfolio', 'https://pillar.vc/feed/'], NOW(), 'unverified'),
('FirstMark Capital', 'firstmarkcap.com', 'vc_firm', 'New York', 'us', ARRAY['https://firstmarkcap.com', 'https://firstmarkcap.com/portfolio', 'https://firstmarkcap.com/feed/'], NOW(), 'unverified'),
('Insight Partners', 'insightpartners.com', 'vc_firm', 'New York', 'us', ARRAY['https://insightpartners.com', 'https://insightpartners.com/portfolio', 'https://insightpartners.com/feed/'], NOW(), 'unverified'),
('Battery Ventures', 'battery.com', 'vc_firm', 'San Francisco', 'us', ARRAY['https://battery.com', 'https://battery.com/portfolio', 'https://battery.com/feed/'], NOW(), 'unverified'),
('Redpoint Ventures', 'redpoint.com', 'vc_firm', 'Menlo Park', 'us', ARRAY['https://redpoint.com', 'https://redpoint.com/portfolio', 'https://redpoint.com/feed/'], NOW(), 'unverified');

-- ============================================
-- TIER 3: India / South Asia AI-Focused (8)
-- ============================================

INSERT INTO funds (canonical_name, canonical_domain, firm_type, hq_city, hq_country, source_links, last_verified_at, verification_status) VALUES
('Peak XV Partners', 'peakxv.com', 'vc_firm', 'Bengaluru', 'india', ARRAY['https://peakxv.com', 'https://peakxv.com/portfolio', 'https://peakxv.com/feed/'], NOW(), 'unverified'),
('Accel India', 'accel.com', 'vc_firm', 'Bengaluru', 'india', ARRAY['https://accel.com/india', 'https://accel.com/india/portfolio', 'https://accel.com/india/feed/'], NOW(), 'unverified'),
('Matrix Partners India', 'matrixpartners.in', 'vc_firm', 'Bengaluru', 'india', ARRAY['https://matrixpartners.in', 'https://matrixpartners.in/portfolio', 'https://matrixpartners.in/feed/'], NOW(), 'unverified'),
('Blume Ventures', 'blume.vc', 'vc_firm', 'Mumbai', 'india', ARRAY['https://blume.vc', 'https://blume.vc/portfolio', 'https://blume.vc/feed/'], NOW(), 'unverified'),
('Elevate Capital', 'elevatecapital.in', 'vc_firm', 'Bengaluru', 'india', ARRAY['https://elevatecapital.in', 'https://elevatecapital.in/portfolio', 'https://elevatecapital.in/feed/'], NOW(), 'unverified'),
('3one4 Capital', '3one4capital.com', 'vc_firm', 'Bengaluru', 'india', ARRAY['https://3one4capital.com', 'https://3one4capital.com/portfolio', 'https://3one4capital.com/feed/'], NOW(), 'unverified'),
('Chiratae Ventures', 'chiratae.com', 'vc_firm', 'Bengaluru', 'india', ARRAY['https://chiratae.com', 'https://chiratae.com/portfolio', 'https://chiratae.com/feed/'], NOW(), 'unverified'),
('Together Fund', 'together.fund', 'vc_firm', 'Bengaluru', 'india', ARRAY['https://together.fund', 'https://together.fund/portfolio', 'https://together.fund/feed/'], NOW(), 'unverified');

-- ============================================
-- TIER 4: Israel / EU / Canada / Emerging (8)
-- ============================================

INSERT INTO funds (canonical_name, canonical_domain, firm_type, hq_city, hq_country, source_links, last_verified_at, verification_status) VALUES
('Aleph', 'aleph.vc', 'vc_firm', 'Tel Aviv', 'israel', ARRAY['https://aleph.vc', 'https://aleph.vc/portfolio', 'https://aleph.vc/feed/'], NOW(), 'unverified'),
('TLV Partners', 'tlvpartners.com', 'vc_firm', 'Tel Aviv', 'israel', ARRAY['https://tlvpartners.com', 'https://tlvpartners.com/portfolio', 'https://tlvpartners.com/feed/'], NOW(), 'unverified'),
('Atomico', 'atomico.com', 'vc_firm', 'London', 'uk', ARRAY['https://atomico.com', 'https://atomico.com/portfolio', 'https://atomico.com/feed/'], NOW(), 'unverified'),
('Balderton Capital', 'balderton.com', 'vc_firm', 'London', 'uk', ARRAY['https://balderton.com', 'https://balderton.com/portfolio', 'https://balderton.com/feed/'], NOW(), 'unverified'),
('Creandum', 'creandum.com', 'vc_firm', 'Stockholm', 'eu', ARRAY['https://creandum.com', 'https://creandum.com/portfolio', 'https://creandum.com/feed/'], NOW(), 'unverified'),
('Inovia Capital', 'inovia.vc', 'vc_firm', 'Montreal', 'canada', ARRAY['https://inovia.vc', 'https://inovia.vc/portfolio', 'https://inovia.vc/feed/'], NOW(), 'unverified'),
('OMERS Ventures', 'omersventures.com', 'vc_firm', 'Toronto', 'canada', ARRAY['https://omersventures.com', 'https://omersventures.com/portfolio', 'https://omersventures.com/feed/'], NOW(), 'unverified'),
('HG Ventures', 'hgventures.vc', 'vc_firm', 'Singapore', 'sea', ARRAY['https://hgventures.vc', 'https://hgventures.vc/portfolio', 'https://hgventures.vc/feed/'], NOW(), 'unverified');

-- ============================================
-- TIER 5: Corporate / Strategic AI Funds (8)
-- ============================================

INSERT INTO funds (canonical_name, canonical_domain, firm_type, hq_city, hq_country, source_links, last_verified_at, verification_status) VALUES
('Salesforce Ventures', 'salesforceventures.com', 'corporate', 'San Francisco', 'us', ARRAY['https://salesforceventures.com', 'https://salesforceventures.com/portfolio', 'https://salesforceventures.com/feed/'], NOW(), 'unverified'),
('Databricks Ventures', 'databricks.com', 'corporate', 'San Francisco', 'us', ARRAY['https://databricks.com/ventures', 'https://databricks.com/ventures/portfolio', 'https://databricks.com/ventures/feed/'], NOW(), 'unverified'),
('Snowflake Ventures', 'snowflake.com', 'corporate', 'Bozeman', 'us', ARRAY['https://snowflake.com/ventures', 'https://snowflake.com/ventures/portfolio', 'https://snowflake.com/ventures/feed/'], NOW(), 'unverified'),
('Workday Ventures', 'workday.com', 'corporate', 'Pleasanton', 'us', ARRAY['https://workday.com/ventures', 'https://workday.com/ventures/portfolio', 'https://workday.com/ventures/feed/'], NOW(), 'unverified'),
('Adobe Ventures', 'adobe.com', 'corporate', 'San Jose', 'us', ARRAY['https://adobe.com/ventures', 'https://adobe.com/ventures/portfolio', 'https://adobe.com/ventures/feed/'], NOW(), 'unverified'),
('Samsung Next', 'samsungnext.com', 'corporate', 'Mountain View', 'us', ARRAY['https://samsungnext.com', 'https://samsungnext.com/portfolio', 'https://samsungnext.com/feed/'], NOW(), 'unverified'),
('Intel Capital', 'intelcapital.com', 'corporate', 'Santa Clara', 'us', ARRAY['https://intelcapital.com', 'https://intelcapital.com/portfolio', 'https://intelcapital.com/feed/'], NOW(), 'unverified'),
('Amazon Alexa Fund', 'amazon.com', 'corporate', 'Seattle', 'us', ARRAY['https://amazon.com/alexafund', 'https://amazon.com/alexafund/portfolio', 'https://amazon.com/alexafund/feed/'], NOW(), 'unverified');

-- ============================================
-- Stated Thesis Excerpts (Sample for key funds)
-- ============================================

-- Sequoia
WITH seq AS (SELECT id FROM funds WHERE canonical_name = 'Sequoia Capital')
INSERT INTO stated_thesis (fund_id, text, source_url, source_type, date_stated) SELECT id,
  'AI represents a platform shift comparable to the internet and mobile. We invest across the stack: foundation models, infrastructure, and applications.',
  'https://sequoiacap.com/article/ai-a-new-era/', 'blog', '2023-06-15' FROM seq;

-- a16z
WITH a16z AS (SELECT id FROM funds WHERE canonical_name = 'Andreessen Horowitz')
INSERT INTO stated_thesis (fund_id, text, source_url, source_type, date_stated) SELECT id,
  'AI is the ultimate software abstraction layer. Every application will be rewritten with AI at its core. We back founders building the AI-first stack.',
  'https://a16z.com/ai-canon/', 'blog', '2023-05-01' FROM a16z;

-- Radical Ventures
WITH rad AS (SELECT id FROM funds WHERE canonical_name = 'Radical Ventures')
INSERT INTO stated_thesis (fund_id, text, source_url, source_type, date_stated) SELECT id,
  'We invest exclusively in AI-first companies. The next generation of category-defining companies will be built by researchers turning breakthroughs into products.',
  'https://radical.vc/thesis/', 'blog', '2024-01-15' FROM rad;

-- Air Street Capital
WITH air AS (SELECT id FROM funds WHERE canonical_name = 'Air Street Capital')
INSERT INTO stated_thesis (fund_id, text, source_url, source_type, date_stated) SELECT id,
  'AI is the new electricity. We back founders building the infrastructure, tools, and applications that will power the AI economy.',
  'https://airstreet.com/thesis/', 'blog', '2024-02-01' FROM air;

-- Index Ventures
WITH idx AS (SELECT id FROM funds WHERE canonical_name = 'Index Ventures')
INSERT INTO stated_thesis (fund_id, text, source_url, source_type, date_stated) SELECT id,
  'We are in the platform shift to AI. Every layer of the stack is being rewritten. We partner with founders from seed to IPO.',
  'https://indexventures.com/perspectives/ai-the-platform-shift/', 'blog', '2023-10-01' FROM idx;

-- ============================================
-- Verification Query
-- ============================================
-- SELECT f.canonical_name, f.firm_type, f.hq_city, f.hq_country,
--        COUNT(fv.id) as vehicle_count,
--        COUNT(st.id) as thesis_count
-- FROM funds f
-- LEFT JOIN fund_vehicles fv ON fv.fund_id = f.id
-- LEFT JOIN stated_thesis st ON st.fund_id = f.id
-- GROUP BY f.id
-- ORDER BY f.canonical_name;
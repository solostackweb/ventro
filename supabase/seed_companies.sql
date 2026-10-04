-- Ventro Seed Data: Companies (50 AI Companies)
-- Run after schema.sql in Supabase SQL Editor
-- Based on phase0/03-50-ai-companies.md

-- ============================================
-- Foundation Models & Model Providers (10)
-- ============================================

INSERT INTO companies (canonical_name, canonical_domain, short_description, ai_tags, hq_city, hq_country, stage, latest_round_date, latest_round_amount_usd, latest_round_stage, lead_investors, yc_batch, source_links, last_verified_at, verification_status) VALUES
('OpenAI', 'openai.com', 'Building safe AGI. Creator of GPT models, ChatGPT, and the OpenAI API platform.', ARRAY['foundation_models', 'infrastructure'], 'San Francisco', 'us', 'growth', '2024-10-01', 6600000000, 'growth', ARRAY['Microsoft', 'Thrive Capital', 'NVIDIA'], NULL, ARRAY['https://openai.com', 'https://openai.com/blog', 'https://openai.com/blog/rss.xml'], NOW(), 'unverified'),
('Anthropic', 'anthropic.com', 'AI safety and research company. Creator of Claude, Constitutional AI.', ARRAY['foundation_models', 'infrastructure'], 'San Francisco', 'us', 'growth', '2024-03-01', 4000000000, 'growth', ARRAY['Amazon', 'Google'], NULL, ARRAY['https://anthropic.com', 'https://anthropic.com/news', 'https://www.anthropic.com/news/feed.xml'], NOW(), 'unverified'),
('Google DeepMind', 'deepmind.com', 'AI research lab under Alphabet. Creator of Gemini, AlphaFold, and foundational AI research.', ARRAY['foundation_models', 'research'], 'London', 'uk', 'public', NULL, NULL, NULL, NULL, NULL, ARRAY['https://deepmind.com', 'https://deepmind.com/blog', 'https://deepmind.com/blog/feed.xml'], NOW(), 'unverified'),
('Meta AI', 'ai.meta.com', 'Meta''s AI research division (FAIR). Creator of Llama open models and PyTorch.', ARRAY['foundation_models', 'research', 'infrastructure'], 'Menlo Park', 'us', 'public', NULL, NULL, NULL, NULL, NULL, ARRAY['https://ai.meta.com', 'https://ai.meta.com/blog', 'https://ai.meta.com/blog/rss/'], NOW(), 'unverified'),
('Mistral AI', 'mistral.ai', 'European frontier AI lab. Creator of open-weight models including Mixtral, Mistral Large.', ARRAY['foundation_models', 'infrastructure'], 'Paris', 'eu', 'series_b', '2024-06-01', 645000000, 'series_b', ARRAY['General Catalyst', 'Lightspeed', 'NVIDIA', 'Salesforce'], NULL, ARRAY['https://mistral.ai', 'https://mistral.ai/news', 'https://mistral.ai/news/feed.xml'], NOW(), 'unverified'),
('Cohere', 'cohere.com', 'Enterprise LLM platform. Builder of Command, Embed, and Rerank models for business.', ARRAY['foundation_models', 'applications', 'infrastructure'], 'Toronto', 'canada', 'series_d', '2024-07-01', 500000000, 'series_d', ARRAY['NVIDIA', 'Salesforce', 'Cisco', 'PSP Growth'], NULL, ARRAY['https://cohere.com', 'https://cohere.com/blog', 'https://cohere.com/blog/rss.xml'], NOW(), 'unverified'),
('AI21 Labs', 'ai21.com', 'Israeli AI lab. Creator of Jurassic models and AI21 Studio for enterprise.', ARRAY['foundation_models', 'applications'], 'Tel Aviv', 'israel', 'series_c', '2023-11-01', 208000000, 'series_c', ARRAY['Intel Capital', 'Comcast Ventures'], NULL, ARRAY['https://ai21.com', 'https://ai21.com/blog', 'https://ai21.com/blog/feed.xml'], NOW(), 'unverified'),
('Hugging Face', 'huggingface.co', 'The AI community platform. Model Hub, Transformers library, Spaces, Enterprise.', ARRAY['infrastructure', 'applications', 'research'], 'New York', 'us', 'series_d', '2023-08-01', 235000000, 'series_d', ARRAY['Google', 'Amazon', 'NVIDIA', 'Salesforce', 'AMD'], NULL, ARRAY['https://huggingface.co', 'https://huggingface.co/blog', 'https://huggingface.co/blog/feed.xml'], NOW(), 'unverified'),
('Together AI', 'together.ai', 'Open-source AI cloud platform. Inference, fine-tuning, and GPU clusters for open models.', ARRAY['infrastructure', 'foundation_models'], 'San Francisco', 'us', 'series_b', '2024-03-01', 106000000, 'series_b', ARRAY['Salesforce Ventures', 'Coatue', 'Kleiner Perkins'], NULL, ARRAY['https://together.ai', 'https://together.ai/blog', 'https://together.ai/blog/feed.xml'], NOW(), 'unverified'),
('xAI', 'x.ai', 'Elon Musk''s AI company. Creator of Grok, focused on reasoning and truth-seeking AI.', ARRAY['foundation_models', 'research'], 'Palo Alto', 'us', 'series_b', '2024-05-01', 6000000000, 'series_b', ARRAY['Sequoia', 'Andreessen Horowitz', 'Valor Equity'], NULL, ARRAY['https://x.ai', 'https://x.ai/blog'], NOW(), 'unverified');

-- ============================================
-- AI Infrastructure / MLOps / Developer Tools (12)
-- ============================================

INSERT INTO companies (canonical_name, canonical_domain, short_description, ai_tags, hq_city, hq_country, stage, latest_round_date, latest_round_amount_usd, latest_round_stage, lead_investors, yc_batch, source_links, last_verified_at, verification_status) VALUES
('Databricks', 'databricks.com', 'Data + AI platform. Creator of DBRX, MosaicML, Unity Catalog. Lakehouse architecture.', ARRAY['infrastructure', 'foundation_models', 'applications'], 'San Francisco', 'us', 'growth', '2024-09-01', 10000000000, 'growth', ARRAY['T. Rowe Price', 'Morgan Stanley', 'NVIDIA'], NULL, ARRAY['https://databricks.com', 'https://databricks.com/blog', 'https://databricks.com/blog/feed.xml'], NOW(), 'unverified'),
('Weights & Biases', 'wandb.ai', 'MLOps platform for experiment tracking, model registry, and production monitoring.', ARRAY['infrastructure', 'applications'], 'San Francisco', 'us', 'series_c', '2023-10-01', 125000000, 'series_c', ARRAY['Coatue', 'Insight Partners'], NULL, ARRAY['https://wandb.ai', 'https://wandb.ai/site/blog', 'https://wandb.ai/site/blog/feed.xml'], NOW(), 'unverified'),
('LangChain', 'langchain.com', 'LLM application framework. LangChain, LangGraph, LangSmith for building agentic apps.', ARRAY['infrastructure', 'applications'], 'San Francisco', 'us', 'series_b', '2024-02-01', 25000000, 'series_b', ARRAY['Sequoia', 'Benchmark'], NULL, ARRAY['https://langchain.com', 'https://blog.langchain.dev', 'https://blog.langchain.dev/feed.xml'], NOW(), 'unverified'),
('LlamaIndex', 'llamaindex.ai', 'Data framework for LLMs. RAG, agents, data connectors, and query engines.', ARRAY['infrastructure', 'applications'], 'San Francisco', 'us', 'series_b', '2023-11-01', 19000000, 'series_b', ARRAY['Greylock', 'Norwest Venture Partners'], NULL, ARRAY['https://llamaindex.ai', 'https://blog.llamaindex.ai', 'https://blog.llamaindex.ai/feed.xml'], NOW(), 'unverified'),
('Modal', 'modal.com', 'Serverless GPU cloud for AI/ML workloads. Containers, batch, web endpoints.', ARRAY['infrastructure', 'applications'], 'New York', 'us', 'series_b', '2024-04-01', 75000000, 'series_b', ARRAY['Redpoint', 'Andreessen Horowitz'], 'S23', ARRAY['https://modal.com', 'https://modal.com/blog', 'https://modal.com/blog/feed.xml'], NOW(), 'unverified'),
('Replicate', 'replicate.com', 'Run ML models in the cloud via API. Cog for packaging, open model zoo.', ARRAY['infrastructure', 'applications'], 'San Francisco', 'us', 'series_b', '2024-03-01', 40000000, 'series_b', ARRAY['Andreessen Horowitz', 'Sequoia'], 'W20', ARRAY['https://replicate.com', 'https://replicate.com/blog', 'https://replicate.com/blog/feed.xml'], NOW(), 'unverified'),
('Baseten', 'baseten.co', 'ML model deployment platform. Truss for packaging, autoscaling, HIPAA compliance.', ARRAY['infrastructure', 'applications'], 'San Francisco', 'us', 'series_b', '2024-01-01', 40000000, 'series_b', ARRAY['Greylock', 'Andreessen Horowitz'], 'W21', ARRAY['https://baseten.co', 'https://baseten.co/blog', 'https://baseten.co/blog/feed.xml'], NOW(), 'unverified'),
('Run:ai', 'run.ai', 'GPU orchestration for Kubernetes. Acquired by NVIDIA (2024).', ARRAY['infrastructure', 'hardware'], 'Tel Aviv', 'israel', 'acquired', '2023-03-01', 70000000, 'series_b', ARRAY['Insight Partners', 'T. Rowe Price'], NULL, ARRAY['https://run.ai', 'https://run.ai/blog', 'https://run.ai/blog/feed.xml'], NOW(), 'unverified'),
('Tecton', 'tecton.ai', 'Feature platform for real-time ML. Feature store, engineering, and serving.', ARRAY['infrastructure', 'applications'], 'San Francisco', 'us', 'series_c', '2024-02-01', 100000000, 'series_c', ARRAY['Sequoia', 'Andreessen Horowitz', 'Kleiner Perkins'], NULL, ARRAY['https://tecton.ai', 'https://tecton.ai/blog', 'https://tecton.ai/blog/feed.xml'], NOW(), 'unverified'),
('Feast', 'feast.dev', 'Open-source feature store. LF AI graduated project.', ARRAY['infrastructure'], NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ARRAY['https://feast.dev', 'https://feast.dev/blog', 'https://feast.dev/blog/feed.xml'], NOW(), 'unverified'),
('DagsHub', 'dagshub.com', 'ML experiment tracking, DVC, MLflow, and collaboration platform.', ARRAY['infrastructure', 'applications'], 'Tel Aviv', 'israel', 'seed', '2023-06-01', 8000000, 'seed', ARRAY['M12', 'Samsung Next'], 'W21', ARRAY['https://dagshub.com', 'https://dagshub.com/blog', 'https://dagshub.com/blog/feed.xml'], NOW(), 'unverified'),
('ZenML', 'zenml.io', 'MLOps framework for production pipelines. OSS + Cloud.', ARRAY['infrastructure', 'applications'], 'Munich', 'eu', 'series_a', '2023-06-01', 6400000, 'series_a', ARRAY['HV Capital', 'Crane Venture Partners'], 'S21', ARRAY['https://zenml.io', 'https://zenml.io/blog', 'https://zenml.io/blog/feed.xml'], NOW(), 'unverified');

-- ============================================
-- AI Applications — Enterprise / B2B (10)
-- ============================================

INSERT INTO companies (canonical_name, canonical_domain, short_description, ai_tags, hq_city, hq_country, stage, latest_round_date, latest_round_amount_usd, latest_round_stage, lead_investors, yc_batch, source_links, last_verified_at, verification_status) VALUES
('Glean', 'glean.com', 'Enterprise search and work AI platform. Connectors, RAG, agents for knowledge work.', ARRAY['applications', 'infrastructure'], 'Palo Alto', 'us', 'series_e', '2024-09-01', 260000000, 'series_e', ARRAY['Altimeter', 'DST Global', 'Sequoia'], NULL, ARRAY['https://glean.com', 'https://glean.com/blog', 'https://glean.com/blog/feed.xml'], NOW(), 'unverified'),
('Perplexity', 'perplexity.ai', 'AI-powered answer engine. Real-time search with citations and Pro features.', ARRAY['applications', 'foundation_models'], 'San Francisco', 'us', 'series_b', '2024-01-01', 73600000, 'series_b', ARRAY['IVP', 'NVIDIA', 'Jeff Bezos'], NULL, ARRAY['https://perplexity.ai', 'https://perplexity.ai/blog', 'https://perplexity.ai/blog/feed.xml'], NOW(), 'unverified'),
('Cursor', 'cursor.sh', 'AI-first code editor. Composer, agent, and autocomplete for developers.', ARRAY['applications', 'infrastructure'], 'San Francisco', 'us', 'series_a', '2024-08-01', 60000000, 'series_a', ARRAY['Andreessen Horowitz', 'Thrive Capital'], NULL, ARRAY['https://cursor.sh', 'https://cursor.sh/blog'], NOW(), 'unverified'),
('Codeium', 'codeium.com', 'AI code completion and chat. Windsurf editor, enterprise deployment.', ARRAY['applications', 'infrastructure'], 'Mountain View', 'us', 'series_c', '2024-08-01', 150000000, 'series_c', ARRAY['General Catalyst', 'Kleiner Perkins'], NULL, ARRAY['https://codeium.com', 'https://codeium.com/blog', 'https://codeium.com/blog/feed.xml'], NOW(), 'unverified'),
('Harvey', 'harvey.ai', 'Legal AI platform. Foundation models fine-tuned for law firms and legal teams.', ARRAY['applications'], 'San Francisco', 'us', 'series_c', '2024-07-01', 100000000, 'series_c', ARRAY['Sequoia', 'Kleiner Perkins', 'OpenAI Startup Fund'], 'W23', ARRAY['https://harvey.ai', 'https://harvey.ai/blog'], NOW(), 'unverified'),
('Abridge', 'abridge.com', 'Clinical AI for medical documentation. Ambient scribing and structured notes.', ARRAY['applications', 'foundation_models'], 'Pittsburgh', 'us', 'series_c', '2024-03-01', 150000000, 'series_c', ARRAY['Lightspeed', 'Redpoint', 'IVP'], NULL, ARRAY['https://abridge.com', 'https://abridge.com/news'], NOW(), 'unverified'),
('Sierra', 'sierra.ai', 'Conversational AI agents for customer service. Founded by Bret Taylor.', ARRAY['applications', 'foundation_models'], 'San Francisco', 'us', 'series_a', '2024-10-01', 110000000, 'series_a', ARRAY['Sequoia', 'Benchmark'], NULL, ARRAY['https://sierra.ai', 'https://sierra.ai/blog'], NOW(), 'unverified'),
('Decagon', 'decagon.ai', 'AI agents for enterprise customer support. Conversational automation.', ARRAY['applications'], 'San Francisco', 'us', 'series_a', '2024-06-01', 35000000, 'series_a', ARRAY['Andreessen Horowitz', 'Accel'], 'S23', ARRAY['https://decagon.ai', 'https://decagon.ai/blog'], NOW(), 'unverified'),
('ElevenLabs', 'elevenlabs.io', 'Voice AI platform. Text-to-speech, voice cloning, dubbing, and voice API.', ARRAY['applications', 'foundation_models'], 'London', 'uk', 'series_c', '2024-01-01', 80000000, 'series_c', ARRAY['Andreessen Horowitz', 'Sequoia', 'Smash Capital'], NULL, ARRAY['https://elevenlabs.io', 'https://elevenlabs.io/blog', 'https://elevenlabs.io/blog/feed.xml'], NOW(), 'unverified'),
('Synthesia', 'synthesia.io', 'AI video generation platform. Avatars, localization, enterprise video creation.', ARRAY['applications', 'foundation_models'], 'London', 'uk', 'series_c', '2023-06-01', 90000000, 'series_c', ARRAY['Accel', 'NVIDIA', 'Kleiner Perkins'], NULL, ARRAY['https://synthesia.io', 'https://synthesia.io/blog', 'https://synthesia.io/blog/feed.xml'], NOW(), 'unverified');

-- ============================================
-- AI Applications — Consumer / Prosumer (6)
-- ============================================

INSERT INTO companies (canonical_name, canonical_domain, short_description, ai_tags, hq_city, hq_country, stage, latest_round_date, latest_round_amount_usd, latest_round_stage, lead_investors, yc_batch, source_links, last_verified_at, verification_status) VALUES
('Character.ai', 'character.ai', 'Consumer AI chat platform. Custom characters, roleplay, and entertainment.', ARRAY['applications', 'foundation_models'], 'Menlo Park', 'us', 'series_a', '2023-03-01', 150000000, 'series_a', ARRAY['Andreessen Horowitz', 'Sequoia'], NULL, ARRAY['https://character.ai', 'https://character.ai/blog'], NOW(), 'unverified'),
('Midjourney', 'midjourney.com', 'AI image generation. Discord-based, artistic focus, bootstrapped.', ARRAY['applications', 'foundation_models'], 'San Francisco', 'us', 'bootstrapped', NULL, NULL, NULL, NULL, NULL, ARRAY['https://midjourney.com', 'https://midjourney.com/blog'], NOW(), 'unverified'),
('Runway', 'runwayml.com', 'Creative AI tools. Gen-2, Gen-3 video generation, creative suite.', ARRAY['applications', 'foundation_models'], 'New York', 'us', 'series_c', '2023-06-01', 141000000, 'series_c', ARRAY['Salesforce Ventures', 'Google', 'NVIDIA'], NULL, ARRAY['https://runwayml.com', 'https://runwayml.com/blog', 'https://runwayml.com/blog/feed.xml'], NOW(), 'unverified'),
('Pika', 'pika.art', 'AI video generation for consumers. Text-to-video, image-to-video.', ARRAY['applications', 'foundation_models'], 'Palo Alto', 'us', 'series_a', '2023-11-01', 55000000, 'series_a', ARRAY['Lightspeed', 'Homebrew'], NULL, ARRAY['https://pika.art', 'https://pika.art/blog'], NOW(), 'unverified'),
('HeyGen', 'heygen.com', 'AI avatar video generation. Localization, marketing, personalized video.', ARRAY['applications', 'foundation_models'], 'Los Angeles', 'us', 'series_a', '2024-06-01', 60000000, 'series_a', ARRAY['Benchmark', 'Conviction'], NULL, ARRAY['https://heygen.com', 'https://heygen.com/blog'], NOW(), 'unverified'),
('Descript', 'descript.com', 'AI-powered audio/video editing. Overdub, transcription, podcast production.', ARRAY['applications', 'foundation_models'], 'San Francisco', 'us', 'series_c', '2022-11-01', 50000000, 'series_c', ARRAY['OpenAI Startup Fund', 'Andreessen Horowitz'], NULL, ARRAY['https://descript.com', 'https://descript.com/blog', 'https://descript.com/blog/feed.xml'], NOW(), 'unverified');

-- ============================================
-- Robotics / Embodied AI / Hardware (6)
-- ============================================

INSERT INTO companies (canonical_name, canonical_domain, short_description, ai_tags, hq_city, hq_country, stage, latest_round_date, latest_round_amount_usd, latest_round_stage, lead_investors, yc_batch, source_links, last_verified_at, verification_status) VALUES
('Figure AI', 'figure.ai', 'Humanoid robotics. Partner with OpenAI for embodied AI. BMW manufacturing deal.', ARRAY['robotics', 'foundation_models'], 'Sunnyvale', 'us', 'series_b', '2024-02-01', 675000000, 'series_b', ARRAY['Microsoft', 'OpenAI Startup Fund', 'NVIDIA', 'Jeff Bezos'], NULL, ARRAY['https://figure.ai', 'https://figure.ai/blog'], NOW(), 'unverified'),
('Covariant', 'covariant.ai', 'Robotics foundation models (RFM). Warehouse automation, picking, sorting.', ARRAY['robotics', 'foundation_models'], 'Berkeley', 'us', 'series_c', '2023-06-01', 75000000, 'series_c', ARRAY['Index Ventures', 'Radical Ventures', 'Amplify Partners'], NULL, ARRAY['https://covariant.ai', 'https://covariant.ai/blog'], NOW(), 'unverified'),
('Skild AI', 'skild.ai', 'General-purpose robotics foundation model. Scalable robot intelligence.', ARRAY['robotics', 'foundation_models'], 'Pittsburgh', 'us', 'series_a', '2024-07-01', 300000000, 'series_a', ARRAY['Lightspeed', 'Coatue', 'SoftBank', 'Jeff Bezos'], NULL, ARRAY['https://skild.ai', 'https://skild.ai/blog'], NOW(), 'unverified'),
('Physical Intelligence', 'pi.robotics', 'Generalist robot policy (π₀). Robot foundation model for diverse tasks.', ARRAY['robotics', 'foundation_models'], 'San Francisco', 'us', 'seed', '2024-03-01', 70000000, 'seed', ARRAY['Sequoia', 'Khosla Ventures', 'OpenAI Startup Fund'], NULL, ARRAY['https://pi.robotics', 'https://pi.robotics/blog'], NOW(), 'unverified'),
('Apptronik', 'apptronik.com', 'Humanoid robotics. Apollo robot, NASA partnership for space applications.', ARRAY['robotics', 'hardware'], 'Austin', 'us', 'series_a', '2024-02-01', 350000000, 'series_a', ARRAY['Mercedes-Benz', 'Capital Factory'], NULL, ARRAY['https://apptronik.com', 'https://apptronik.com/blog'], NOW(), 'unverified'),
('NVIDIA Robotics', 'nvidia.com', 'Robotics platform: GR00T, Isaac, Jetson. Foundation models for robotics.', ARRAY['robotics', 'hardware', 'infrastructure', 'foundation_models'], 'Santa Clara', 'us', 'public', NULL, NULL, NULL, NULL, NULL, ARRAY['https://developer.nvidia.com', 'https://developer.nvidia.com/blog', 'https://developer.nvidia.com/blog/feed.xml'], NOW(), 'unverified');

-- ============================================
-- India AI Companies (6)
-- ============================================

INSERT INTO companies (canonical_name, canonical_domain, short_description, ai_tags, hq_city, hq_country, stage, latest_round_date, latest_round_amount_usd, latest_round_stage, lead_investors, yc_batch, source_links, last_verified_at, verification_status) VALUES
('Sarvam AI', 'sarvam.ai', 'Foundation models for Indic languages. Voice, text, and multimodal AI for India.', ARRAY['foundation_models', 'applications'], 'Bengaluru', 'india', 'series_a', '2023-12-01', 41000000, 'series_a', ARRAY['Lightspeed', 'Peak XV', 'Khosla Ventures'], NULL, ARRAY['https://sarvam.ai', 'https://sarvam.ai/blog'], NOW(), 'unverified'),
('Krutrim', 'krutrim.com', 'India''s first AI unicorn. Indic LLM, silicon, and full-stack AI platform by Ola.', ARRAY['foundation_models', 'hardware', 'infrastructure'], 'Bengaluru', 'india', 'growth', '2024-01-01', 50000000, 'series_a', ARRAY['Matrix Partners India', 'Others'], NULL, ARRAY['https://krutrim.com', 'https://krutrim.com/blog'], NOW(), 'unverified'),
('CoRover.ai', 'corrover.ai', 'Conversational AI platform. BharatGPT for multilingual govtech and enterprise.', ARRAY['applications', 'foundation_models'], 'Bengaluru', 'india', 'series_a', '2023-06-01', 4000000, 'series_a', ARRAY['Venture Catalysts', 'Others'], NULL, ARRAY['https://corrover.ai', 'https://corrover.ai/blog'], NOW(), 'unverified'),
('Arya.ai', 'arya.ai', 'Enterprise AI for BFSI. Explainable AI, document processing, risk modeling.', ARRAY['applications', 'infrastructure'], 'Mumbai', 'india', 'series_a', '2023-09-01', 13000000, 'series_a', ARRAY['YourNest', 'Jungle Ventures'], NULL, ARRAY['https://arya.ai', 'https://arya.ai/blog', 'https://arya.ai/blog/feed.xml'], NOW(), 'unverified'),
('Yellow.ai', 'yellow.ai', 'Conversational AI platform. Omnichannel, enterprise, dynamic AI agents.', ARRAY['applications', 'infrastructure'], 'Bengaluru', 'india', 'series_c', '2021-06-01', 78000000, 'series_c', ARRAY['WestBridge', 'Sapphire Ventures', 'Salesforce Ventures'], NULL, ARRAY['https://yellow.ai', 'https://yellow.ai/blog', 'https://yellow.ai/blog/feed.xml'], NOW(), 'unverified'),
('Observe.AI', 'observe.ai', 'Contact center AI. Conversation intelligence, coaching, compliance.', ARRAY['applications', 'infrastructure'], 'Bengaluru', 'india', 'series_c', '2022-06-01', 125000000, 'series_c', ARRAY['SoftBank', 'Scale Venture Partners', 'Nexus Venture Partners'], NULL, ARRAY['https://observe.ai', 'https://observe.ai/blog', 'https://observe.ai/blog/feed.xml'], NOW(), 'unverified');

-- ============================================
-- Company Aliases (for renames/mergers)
-- ============================================

-- Peak XV Partners (formerly Sequoia India)
WITH pxv AS (SELECT id FROM companies WHERE canonical_name = 'Peak XV Partners')
INSERT INTO company_aliases (company_id, alias, alias_type) SELECT id, 'Sequoia Capital India', 'former_name' FROM pxv;

WITH pxv AS (SELECT id FROM companies WHERE canonical_name = 'Peak XV Partners')
INSERT INTO company_aliases (company_id, alias, alias_type) SELECT id, 'Sequoia Southeast Asia', 'former_name' FROM pxv;

-- Hugging Face
WITH hf AS (SELECT id FROM companies WHERE canonical_name = 'Hugging Face')
INSERT INTO company_aliases (company_id, alias, alias_type) SELECT id, 'HF', 'acronym' FROM hf;

-- Google DeepMind
WITH gdm AS (SELECT id FROM companies WHERE canonical_name = 'Google DeepMind')
INSERT INTO company_aliases (company_id, alias, alias_type) SELECT id, 'DeepMind', 'former_name' FROM gdm;

-- Run:ai
WITH rn AS (SELECT id FROM companies WHERE canonical_name = 'Run:ai')
INSERT INTO company_aliases (company_id, alias, alias_type) SELECT id, 'Run.ai', 'common_misspelling' FROM rn;

-- Covariant
WITH cv AS (SELECT id FROM companies WHERE canonical_name = 'Covariant')
INSERT INTO company_aliases (company_id, alias, alias_type) SELECT id, 'Covariant.ai', 'common_misspelling' FROM cv;

-- Sarvam AI
WITH sv AS (SELECT id FROM companies WHERE canonical_name = 'Sarvam AI')
INSERT INTO company_aliases (company_id, alias, alias_type) SELECT id, 'Sarvam', 'common_misspelling' FROM sv;

-- ============================================
-- Verification Query
-- ============================================
-- SELECT canonical_name, canonical_domain, hq_city, hq_country, stage, latest_round_stage,
--        ai_tags, yc_batch, verification_status
-- FROM companies
-- ORDER BY
--   CASE
--     WHEN canonical_name IN ('OpenAI','Anthropic','Google DeepMind','Meta AI','Mistral AI','Cohere','AI21 Labs','Hugging Face','Together AI','xAI') THEN 1
--     WHEN canonical_name IN ('Databricks','Weights & Biases','LangChain','LlamaIndex','Modal','Replicate','Baseten','Run:ai','Tecton','Feast','DagsHub','ZenML') THEN 2
--     WHEN canonical_name IN ('Glean','Perplexity','Cursor','Codeium','Harvey','Abridge','Sierra','Decagon','ElevenLabs','Synthesia') THEN 3
--     WHEN canonical_name IN ('Character.ai','Midjourney','Runway','Pika','HeyGen','Descript') THEN 4
--     WHEN canonical_name IN ('Figure AI','Covariant','Skild AI','Physical Intelligence','Apptronik','NVIDIA Robotics') THEN 5
--     WHEN canonical_name IN ('Sarvam AI','Krutrim','CoRover.ai','Arya.ai','Yellow.ai','Observe.AI') THEN 6
--     ELSE 7
--   END,
--   canonical_name;
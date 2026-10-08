-- Corporate venture and strategic-investor sources are distinct from
-- independent VC blogs and are present in the production connector seed.

ALTER TABLE public.source_connectors
  DROP CONSTRAINT IF EXISTS source_connectors_category_check;

ALTER TABLE public.source_connectors
  ADD CONSTRAINT source_connectors_category_check CHECK (
    category IN (
      'vc_blog', 'corporate', 'company_blog', 'news_aggregator', 'government',
      'developer_platform', 'yc', 'search'
    )
  );


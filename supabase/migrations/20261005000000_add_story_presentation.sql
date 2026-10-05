-- Store source-provided presentation metadata without calling an excerpt a full article summary.
alter table public.stories
  add column if not exists image_url text,
  add column if not exists summary_kind text not null default 'none';

alter table public.stories
  drop constraint if exists stories_summary_kind_check;

alter table public.stories
  add constraint stories_summary_kind_check
  check (summary_kind in ('none', 'source_excerpt', 'article_summary'));

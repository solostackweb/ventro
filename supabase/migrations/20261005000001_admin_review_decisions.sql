-- Human review is an authenticated, atomic database transition. Never grant direct
-- browser update policies on the reviewed tables.
-- user_profiles.role is user-editable in the base schema, so it is NOT an admin authority.
create table if not exists public.admin_users (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  granted_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

create table if not exists public.admin_review_events (
  id uuid primary key default gen_random_uuid(),
  item_kind text not null check (item_kind in ('story', 'funding_round', 'round_participant', 'pattern')),
  item_id uuid not null,
  reviewer_id uuid not null references public.user_profiles(id),
  previous_status text not null,
  new_status text not null,
  reason text not null,
  evidence_urls text[] not null default '{}',
  reviewed_at timestamptz not null default now()
);

create index if not exists admin_review_events_item_idx
  on public.admin_review_events (item_kind, item_id, reviewed_at desc);

alter table public.admin_review_events enable row level security;
revoke all on public.admin_review_events from anon, authenticated;

create or replace function public.admin_review_candidate(
  p_kind text,
  p_id uuid,
  p_expected_status text,
  p_new_status text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_table text;
  v_column text;
  v_old jsonb;
  v_new jsonb;
  v_old_status text;
  v_urls text[] := '{}';
  v_event_id uuid;
begin
  if v_actor is null or not exists (
    select 1 from public.admin_users where user_id = v_actor
  ) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_id is null or p_expected_status is null or p_new_status is null
     or length(trim(coalesce(p_reason, ''))) < 10
     or length(p_reason) > 1000 then
    raise exception 'Review requires an item, expected state, target state, and 10-1000 character reason'
      using errcode = '22023';
  end if;

  case p_kind
    when 'story' then v_table := 'stories'; v_column := 'verification_label';
    when 'funding_round' then v_table := 'funding_rounds'; v_column := 'verification_status';
    when 'round_participant' then v_table := 'round_participants'; v_column := 'verification_status';
    when 'pattern' then v_table := 'patterns'; v_column := 'status';
    else raise exception 'Unsupported review kind' using errcode = '22023';
  end case;

  execute format('select to_jsonb(t) from public.%I t where id = $1 for update', v_table)
    into v_old using p_id;
  if v_old is null then
    raise exception 'Review item not found' using errcode = 'P0002';
  end if;
  v_old_status := v_old ->> v_column;
  if v_old_status is distinct from p_expected_status then
    raise exception 'Review item changed; refresh the queue' using errcode = '40001';
  end if;

  if p_kind = 'pattern' then
    if not ((v_old_status = 'candidate' and p_new_status in ('published', 'rejected'))
      or (v_old_status = 'published' and p_new_status = 'retired')
      or (v_old_status = 'corrected' and p_new_status in ('published', 'retired'))) then
      raise exception 'Invalid pattern review transition' using errcode = '22023';
    end if;
    select coalesce(array_agg(value), '{}') into v_urls
      from jsonb_array_elements_text(coalesce(v_old -> 'source_links', '[]'::jsonb)) value;
    if p_new_status = 'published' and (
      cardinality(v_urls) = 0 or jsonb_array_length(coalesce(v_old -> 'qualifying_events', '[]'::jsonb)) = 0
    ) then
      raise exception 'Pattern needs source links and qualifying events' using errcode = '22023';
    end if;
  else
    if p_new_status not in ('verified', 'partial', 'unverified', 'conflicted')
       or p_new_status = v_old_status then
      raise exception 'Invalid verification transition' using errcode = '22023';
    end if;
    select coalesce(array_agg(value), '{}') into v_urls
      from jsonb_array_elements_text(coalesce(v_old -> 'source_urls', '[]'::jsonb)) value;
    if p_kind = 'story' and cardinality(v_urls) = 0
       and nullif(v_old ->> 'canonical_url', '') is not null then
      v_urls := array[v_old ->> 'canonical_url'];
    end if;
    if p_new_status in ('verified', 'partial') and cardinality(v_urls) = 0 then
      raise exception 'Verified items require original source URLs' using errcode = '22023';
    end if;
    if p_kind = 'round_participant' and p_new_status in ('verified', 'partial')
       and coalesce(v_old ->> 'role', '') not in ('lead', 'co_lead', 'participant') then
      raise exception 'Investor role must be explicit before verification' using errcode = '22023';
    end if;
  end if;

  if p_kind = 'pattern' then
    update public.patterns set status = p_new_status, reviewed_by = v_actor,
      reviewed_at = now() where id = p_id;
  else
    execute format('update public.%I set %I = $1 where id = $2', v_table, v_column)
      using p_new_status, p_id;
  end if;

  insert into public.admin_review_events
    (item_kind, item_id, reviewer_id, previous_status, new_status, reason, evidence_urls)
  values (p_kind, p_id, v_actor, v_old_status, p_new_status, trim(p_reason), v_urls)
  returning id into v_event_id;
  return v_event_id;
end;
$$;

revoke all on function public.admin_review_candidate(text, uuid, text, text, text) from public;
grant execute on function public.admin_review_candidate(text, uuid, text, text, text) to authenticated;

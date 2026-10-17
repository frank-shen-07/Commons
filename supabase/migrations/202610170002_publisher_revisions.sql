-- Draft/review snapshots are private. Only the trusted server can mutate them.
create table public.application_revisions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'approved', 'rejected')),
  version integer not null check (version > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(application_id, version)
);
create unique index application_revisions_one_active on public.application_revisions(application_id)
  where status in ('draft', 'pending_review');
create index application_revisions_latest on public.application_revisions(application_id, version desc);
alter table public.application_revisions enable row level security;
revoke all on public.application_revisions from anon, authenticated;
grant select on public.application_revisions to authenticated;
grant all on public.application_revisions to service_role;
create policy "owners read their revisions" on public.application_revisions for select to authenticated
  using (exists(select 1 from public.applications a where a.id = application_id and a.publisher_id = (select auth.uid())));

-- Null means a legacy listing; its existing downloads are retained until reviewed.
alter table public.applications add column distribution_selection jsonb;

create function public.publisher_save_draft(
  p_owner uuid, p_application_id uuid, p_expected_version integer, p_snapshot jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  a public.applications; r public.application_revisions; app_id uuid := p_application_id;
  i jsonb := p_snapshot->'input'; repo jsonb := p_snapshot->'repository';
  next_version integer; base_slug text;
begin
  if app_id is null then
    if p_expected_version <> 0 then raise exception 'Draft changed. Reload before saving.' using errcode = '40001'; end if;
    app_id := gen_random_uuid();
    base_slug := trim(both '-' from regexp_replace(lower(i->>'name'), '[^a-z0-9]+', '-', 'g'));
    if base_slug = '' then base_slug := 'application'; end if;
    base_slug := trim(both '-' from left(base_slug, 65));
    -- Serialize slug allocation; the repository unique constraint prevents duplicate imports.
    perform pg_advisory_xact_lock(hashtext('commons:publisher-slug'));
    if exists(select 1 from public.applications where slug = base_slug) then
      base_slug := base_slug || '-' || left(app_id::text, 8);
    end if;
    insert into public.applications(id, publisher_id, name, slug, summary, description, icon_url,
      repository_url, repository_owner, repository_name, github_repository_id, license, website_url, web_url)
    values(app_id, p_owner, i->>'name', base_slug, i->>'summary', i->>'description', nullif(i->>'iconUrl',''),
      repo->>'url', split_part(repo->>'fullName','/',1), split_part(repo->>'fullName','/',2),
      (repo->>'id')::bigint, repo->>'license', nullif(i->>'websiteUrl',''), nullif(i->>'webUrl',''));
  end if;
  select * into a from public.applications where id = app_id and publisher_id = p_owner for update;
  if not found then raise exception 'Application not found.' using errcode = 'P0002'; end if;
  if a.status = 'suspended' then raise exception 'This listing is suspended.' using errcode = '55000'; end if;
  if a.github_repository_id <> (repo->>'id')::bigint then raise exception 'Repository changed.' using errcode = '55000'; end if;
  select * into r from public.application_revisions where application_id = app_id order by version desc limit 1 for update;
  if coalesce(r.version, 0) <> p_expected_version then raise exception 'Draft changed. Reload before saving.' using errcode = '40001'; end if;
  if r.status = 'pending_review' then raise exception 'Return the submission to draft before editing.' using errcode = '55000'; end if;
  next_version := coalesce(r.version, 0) + 1;
  if r.status = 'draft' then
    update public.application_revisions set snapshot = p_snapshot, version = next_version, updated_at = now() where id = r.id;
  else
    insert into public.application_revisions(application_id, version, snapshot) values(app_id, next_version, p_snapshot);
  end if;
  -- Published applications are untouched until approval.
  if a.status <> 'published' then
    update public.applications set status = 'draft', name = i->>'name', summary = i->>'summary', description = i->>'description' where id = app_id;
  end if;
  return app_id;
end $$;

create function public.publisher_submit_revision(
  p_owner uuid, p_application_id uuid, p_expected_version integer, p_snapshot jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare a public.applications; r public.application_revisions;
begin
  select * into a from public.applications where id = p_application_id and publisher_id = p_owner for update;
  if not found then raise exception 'Application not found.' using errcode = 'P0002'; end if;
  if a.status not in ('draft', 'published') then raise exception 'Listing cannot be submitted.' using errcode = '55000'; end if;
  select * into r from public.application_revisions where application_id = a.id order by version desc limit 1 for update;
  if coalesce(r.version, 0) <> p_expected_version then raise exception 'Draft changed. Reload before submitting.' using errcode = '40001'; end if;
  if r.status is distinct from 'draft' then raise exception 'Save an editable draft first.' using errcode = '55000'; end if;
  if a.github_repository_id <> (p_snapshot->'repository'->>'id')::bigint then raise exception 'Repository changed.' using errcode = '55000'; end if;
  update public.application_revisions set status = 'pending_review', snapshot = p_snapshot,
    version = version + 1, updated_at = now() where id = r.id;
  if a.status <> 'published' then update public.applications set status = 'pending_review' where id = a.id; end if;
end $$;

create function public.publisher_reopen_revision(p_owner uuid, p_application_id uuid, p_expected_version integer)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.applications; r public.application_revisions;
begin
  select * into a from public.applications where id = p_application_id and publisher_id = p_owner for update;
  if not found then raise exception 'Application not found.' using errcode = 'P0002'; end if;
  if a.status = 'suspended' then raise exception 'This listing is suspended.' using errcode = '55000'; end if;
  select * into r from public.application_revisions where application_id = a.id order by version desc limit 1 for update;
  if coalesce(r.version, 0) <> p_expected_version then raise exception 'Draft changed. Reload first.' using errcode = '40001'; end if;
  if r.status is distinct from 'pending_review' then raise exception 'No pending submission to return to draft.' using errcode = '55000'; end if;
  update public.application_revisions set status = 'draft', version = version + 1, updated_at = now() where id = r.id;
  if a.status = 'pending_review' then update public.applications set status = 'draft' where id = a.id; end if;
end $$;

-- Call only after operator review. Apply all public fields/children in one transaction.
create function public.approve_application_revision(p_revision_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  a public.applications; r public.application_revisions; app_id uuid; i jsonb; repo jsonb;
  rel jsonb; asset jsonb; shot jsonb; selected_version_id uuid; position integer := 0;
begin
  select application_id into app_id from public.application_revisions where id = p_revision_id;
  select * into a from public.applications where id = app_id for update;
  if not found then raise exception 'Application not found.' using errcode = 'P0002'; end if;
  select * into r from public.application_revisions where id = p_revision_id for update;
  if r.status <> 'pending_review' or a.status not in ('pending_review','published') then
    raise exception 'This submission cannot be approved.' using errcode = '55000';
  end if;
  i := r.snapshot->'input'; repo := r.snapshot->'repository';
  if a.github_repository_id <> (repo->>'id')::bigint then raise exception 'Repository changed.' using errcode = '55000'; end if;
  if nullif(repo->>'license','') is null or repo->>'license' = 'NOASSERTION' then raise exception 'Licence required.'; end if;
  delete from public.application_categories where application_id = a.id;
  insert into public.application_categories(application_id, category_id) values(a.id, (r.snapshot->>'categoryId')::uuid);
  delete from public.application_screenshots where application_id = a.id;
  for shot in select value from jsonb_array_elements(i->'screenshots') loop
    insert into public.application_screenshots(application_id,image_url,alt_text,display_order)
      values(a.id, case when jsonb_typeof(shot)='string' then shot#>>'{}' else shot->>'url' end,
        case when jsonb_typeof(shot)='object' then coalesce(shot->>'alt','') else '' end, position);
    position := position+1;
  end loop;
  delete from public.application_versions where application_id = a.id;
  -- Public distribution is precisely the release/assets the publisher submitted.
  select value into rel from jsonb_array_elements(repo->'releases') where value->>'id' = i->>'releaseId';
  if rel is not null then
    insert into public.application_versions(application_id,github_release_id,version,git_tag,release_notes,github_release_url,released_at)
      values(a.id,(rel->>'id')::bigint,rel->>'version',rel->>'version',coalesce(rel->>'notes',''),rel->>'url',(rel->>'publishedAt')::timestamptz)
      returning id into selected_version_id;
    for asset in select candidate.value from jsonb_array_elements(rel->'assets') candidate where exists(
      select 1 from jsonb_array_elements(i->'assets') chosen where chosen.value->>'id' = candidate.value->>'id'
    ) loop
      if not (asset->>'eligible')::boolean then raise exception 'Unsupported installer.'; end if;
      insert into public.release_assets(version_id,github_asset_id,file_name,download_url,file_size_bytes,platform,architecture,kind)
        values(selected_version_id,(asset->>'id')::bigint,asset->>'name',asset->>'url',(asset->>'size')::bigint,
          (asset->>'platform')::public.release_platform,asset->>'architecture','installer');
    end loop;
  end if;
  if nullif(i->>'webUrl','') is null and not exists(select 1 from public.release_assets where release_assets.version_id = selected_version_id) then
    raise exception 'A selected installer or web app is required.';
  end if;
  update public.applications set name=i->>'name', summary=i->>'summary', description=i->>'description',
    icon_url=nullif(i->>'iconUrl',''), website_url=nullif(i->>'websiteUrl',''), web_url=nullif(i->>'webUrl',''),
    repository_url=repo->>'url', repository_owner=split_part(repo->>'fullName','/',1), repository_name=split_part(repo->>'fullName','/',2),
    license=repo->>'license', status='published', published_at=coalesce(published_at,now()),
    distribution_selection=jsonb_build_object('releaseId',i->'releaseId','assets',i->'assets') where id=a.id;
  update public.application_revisions set status='approved', updated_at=now() where id=r.id;
end $$;

revoke all on function public.publisher_save_draft(uuid,uuid,integer,jsonb) from public, anon, authenticated;
revoke all on function public.publisher_submit_revision(uuid,uuid,integer,jsonb) from public, anon, authenticated;
revoke all on function public.publisher_reopen_revision(uuid,uuid,integer) from public, anon, authenticated;
revoke all on function public.approve_application_revision(uuid) from public, anon, authenticated;
grant execute on function public.publisher_save_draft(uuid,uuid,integer,jsonb) to service_role;
grant execute on function public.publisher_submit_revision(uuid,uuid,integer,jsonb) to service_role;
grant execute on function public.publisher_reopen_revision(uuid,uuid,integer) to service_role;
grant execute on function public.approve_application_revision(uuid) to service_role;

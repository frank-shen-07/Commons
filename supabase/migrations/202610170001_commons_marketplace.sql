create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create type public.application_status as enum (
  'draft',
  'pending_review',
  'published',
  'rejected',
  'suspended'
);

create type public.release_platform as enum (
  'windows',
  'macos',
  'linux',
  'web',
  'android',
  'ios',
  'unknown'
);

create type public.asset_kind as enum (
  'installer',
  'portable',
  'web_app',
  'source',
  'other'
);

create table public.developer_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  github_username text not null,
  display_name text not null default '',
  avatar_url text,
  biography text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint developer_profiles_github_username_nonempty
    check (length(trim(github_username)) between 1 and 39),
  constraint developer_profiles_display_name_length
    check (length(display_name) <= 100),
  constraint developer_profiles_biography_length
    check (biography is null or length(biography) <= 1000),
  constraint developer_profiles_avatar_https
    check (avatar_url is null or avatar_url ~* '^https://')
);

create unique index developer_profiles_github_username_ci
  on public.developer_profiles (lower(github_username));
create index developer_profiles_github_username_trgm_idx
  on public.developer_profiles using gin (github_username gin_trgm_ops);
create index developer_profiles_display_name_trgm_idx
  on public.developer_profiles using gin (display_name gin_trgm_ops);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  publisher_id uuid references public.developer_profiles (user_id) on delete set null,
  name text not null,
  slug text not null unique,
  summary text not null,
  description text not null,
  icon_url text,
  repository_url text not null,
  repository_owner text not null,
  repository_name text not null,
  github_repository_id bigint not null unique,
  license text,
  website_url text,
  web_url text,
  status public.application_status not null default 'draft',
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint applications_name_length check (length(trim(name)) between 1 and 80),
  constraint applications_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint applications_summary_length check (length(trim(summary)) between 1 and 160),
  constraint applications_description_length check (length(trim(description)) between 1 and 10000),
  constraint applications_repository_owner_length check (length(repository_owner) between 1 and 39),
  constraint applications_repository_name_length check (length(repository_name) between 1 and 100),
  constraint applications_repository_url_github
    check (repository_url ~* '^https://github\.com/[^/]+/[^/]+/?$'),
  constraint applications_external_urls_https
    check (
      (icon_url is null or icon_url ~* '^https://')
      and (website_url is null or website_url ~* '^https://')
      and (web_url is null or web_url ~* '^https://')
    ),
  constraint applications_published_timestamp check (
    (status = 'published' and published_at is not null)
    or (status <> 'published' and published_at is null)
  )
);

create index applications_publisher_id_idx on public.applications (publisher_id);
create index applications_publication_idx
  on public.applications (published_at desc, id)
  where status = 'published';
create index applications_updated_at_idx on public.applications (updated_at desc, id);
create index applications_repository_idx
  on public.applications (lower(repository_owner), lower(repository_name));
create index applications_name_trgm_idx on public.applications using gin (name gin_trgm_ops);
create index applications_summary_trgm_idx on public.applications using gin (summary gin_trgm_ops);
create index applications_description_trgm_idx on public.applications using gin (description gin_trgm_ops);

create table public.application_categories (
  application_id uuid not null references public.applications (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  primary key (application_id, category_id)
);
create index application_categories_category_idx
  on public.application_categories (category_id, application_id);

create table public.application_versions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  version text not null,
  git_tag text not null,
  release_name text,
  release_notes text not null default '',
  github_release_url text not null,
  released_at timestamptz,
  prerelease boolean not null default false,
  github_release_id bigint not null,
  created_at timestamptz not null default now(),
  unique (application_id, github_release_id),
  constraint application_versions_version_length check (length(version) between 1 and 100),
  constraint application_versions_tag_length check (length(git_tag) between 1 and 100),
  constraint application_versions_release_url_github
    check (github_release_url ~* '^https://github\.com/[^/]+/[^/]+/releases/')
);
create index application_versions_history_idx
  on public.application_versions (application_id, released_at desc nulls last, id desc);

create table public.release_assets (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.application_versions (id) on delete cascade,
  github_asset_id bigint not null,
  file_name text not null,
  download_url text not null,
  mime_type text,
  file_size_bytes bigint,
  platform public.release_platform not null default 'unknown',
  architecture text not null default 'unknown',
  kind public.asset_kind not null default 'other',
  created_at timestamptz not null default now(),
  unique (version_id, github_asset_id),
  constraint release_assets_filename_length check (length(file_name) between 1 and 255),
  constraint release_assets_size_nonnegative check (file_size_bytes is null or file_size_bytes >= 0),
  constraint release_assets_download_url_github
    check (download_url ~* '^https://github\.com/[^/]+/[^/]+/releases/download/')
);
create index release_assets_version_id_idx on public.release_assets (version_id);
create index release_assets_platform_idx on public.release_assets (platform);

create table public.application_screenshots (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  image_url text not null,
  alt_text text not null default '',
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint application_screenshots_order_nonnegative check (display_order >= 0),
  constraint application_screenshots_alt_length check (length(alt_text) <= 300),
  constraint application_screenshots_https check (image_url ~* '^https://'),
  unique (application_id, display_order)
);
create index application_screenshots_application_idx
  on public.application_screenshots (application_id, display_order);

create table public.application_reports (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  reporter_id uuid references auth.users (id) on delete set null,
  reason text not null,
  details text,
  created_at timestamptz not null default now(),
  constraint application_reports_reason check (
    reason in ('malware', 'impersonation', 'license', 'broken', 'other')
  ),
  constraint application_reports_details_length check (
    details is null or length(details) <= 2000
  ),
  unique (application_id, reporter_id)
);
create index application_reports_created_idx on public.application_reports (created_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger developer_profiles_set_updated_at
before update on public.developer_profiles
for each row execute function public.set_updated_at();
create trigger applications_set_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

create function public.guard_developer_github_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'postgres'
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and new.github_username is distinct from old.github_username then
    raise exception 'GitHub identity is managed by the server'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger developer_profiles_guard_github_identity
before update on public.developer_profiles
for each row execute function public.guard_developer_github_identity();

create function public.guard_application_privileged_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'postgres'
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and (
       new.publisher_id is distinct from old.publisher_id
       or new.github_repository_id is distinct from old.github_repository_id
       or new.status is distinct from old.status
       or new.status in ('published', 'rejected', 'suspended')
       or new.featured is distinct from old.featured
       or new.published_at is distinct from old.published_at
       or (old.status = 'pending_review' and new.status = 'pending_review')
     ) then
    raise exception 'privileged application fields cannot be changed by this role'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger applications_guard_privileged_fields
before update on public.applications
for each row execute function public.guard_application_privileged_fields();

insert into public.categories (name, slug) values
  ('Productivity', 'productivity'),
  ('Creativity', 'creativity'),
  ('Developer Tools', 'developer-tools'),
  ('Utilities', 'utilities'),
  ('Education', 'education'),
  ('Security & Privacy', 'security-privacy'),
  ('Communication', 'communication'),
  ('Entertainment', 'entertainment')
on conflict (slug) do nothing;

alter table public.developer_profiles enable row level security;
alter table public.categories enable row level security;
alter table public.applications enable row level security;
alter table public.application_categories enable row level security;
alter table public.application_versions enable row level security;
alter table public.release_assets enable row level security;
alter table public.application_screenshots enable row level security;
alter table public.application_reports enable row level security;

create policy "public can read developer attribution"
  on public.developer_profiles for select to anon, authenticated using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.applications a
      where a.publisher_id = developer_profiles.user_id
        and a.status = 'published'
    )
  );

create policy "public can read categories"
  on public.categories for select to anon, authenticated using (true);

create policy "public can read published applications"
  on public.applications for select to anon, authenticated
  using (status = 'published' or publisher_id = (select auth.uid()));
create policy "owners update non-public listings"
  on public.applications for update to authenticated
  using (publisher_id = (select auth.uid()) and status in ('draft', 'pending_review'))
  with check (publisher_id = (select auth.uid()) and status in ('draft', 'pending_review'));
create policy "owners delete drafts"
  on public.applications for delete to authenticated
  using (publisher_id = (select auth.uid()) and status = 'draft');

create policy "public categories for public applications"
  on public.application_categories for select to anon, authenticated
  using (exists (
    select 1 from public.applications a
    where a.id = application_id
      and (a.status = 'published' or a.publisher_id = (select auth.uid()))
  ));
create policy "owners manage draft categories"
  on public.application_categories for all to authenticated
  using (exists (
    select 1 from public.applications a
    where a.id = application_id and a.publisher_id = (select auth.uid())
      and a.status = 'draft'
  ))
  with check (exists (
    select 1 from public.applications a
    where a.id = application_id and a.publisher_id = (select auth.uid())
      and a.status = 'draft'
  ));

create policy "public versions for public applications"
  on public.application_versions for select to anon, authenticated
  using (exists (
    select 1 from public.applications a
    where a.id = application_id
      and (a.status = 'published' or a.publisher_id = (select auth.uid()))
  ));
create policy "owners manage draft versions"
  on public.application_versions for all to authenticated
  using (exists (
    select 1 from public.applications a
    where a.id = application_id and a.publisher_id = (select auth.uid())
      and a.status = 'draft'
  ))
  with check (exists (
    select 1 from public.applications a
    where a.id = application_id and a.publisher_id = (select auth.uid())
      and a.status = 'draft'
  ));

create policy "public assets for public applications"
  on public.release_assets for select to anon, authenticated
  using (exists (
    select 1 from public.application_versions v
    join public.applications a on a.id = v.application_id
    where v.id = version_id
      and (a.status = 'published' or a.publisher_id = (select auth.uid()))
  ));
create policy "owners manage draft assets"
  on public.release_assets for all to authenticated
  using (exists (
    select 1 from public.application_versions v
    join public.applications a on a.id = v.application_id
    where v.id = version_id and a.publisher_id = (select auth.uid())
      and a.status = 'draft'
  ))
  with check (exists (
    select 1 from public.application_versions v
    join public.applications a on a.id = v.application_id
    where v.id = version_id and a.publisher_id = (select auth.uid())
      and a.status = 'draft'
  ));

create policy "public screenshots for public applications"
  on public.application_screenshots for select to anon, authenticated
  using (exists (
    select 1 from public.applications a
    where a.id = application_id
      and (a.status = 'published' or a.publisher_id = (select auth.uid()))
  ));
create policy "owners manage draft screenshots"
  on public.application_screenshots for all to authenticated
  using (exists (
    select 1 from public.applications a
    where a.id = application_id and a.publisher_id = (select auth.uid())
      and a.status = 'draft'
  ))
  with check (exists (
    select 1 from public.applications a
    where a.id = application_id and a.publisher_id = (select auth.uid())
      and a.status = 'draft'
  ));

create policy "authenticated users submit reports"
  on public.application_reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and exists (
      select 1 from public.applications a
      where a.id = application_id and a.status = 'published'
    )
  );

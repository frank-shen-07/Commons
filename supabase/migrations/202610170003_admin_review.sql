-- Reviewer identity is assigned exclusively by the authenticated server.
alter table public.application_revisions
  add column reviewed_by uuid references auth.users(id) on delete set null,
  add column reviewed_at timestamptz;

create function public.admin_approve_application_revision(
  p_revision_id uuid, p_expected_version integer, p_admin_user_id uuid
) returns table(id uuid, slug text, status public.application_status)
language plpgsql security definer set search_path = '' as $$
declare app_id uuid; a public.applications; r public.application_revisions;
begin
  if p_admin_user_id is null then raise exception 'Reviewer required.' using errcode = '23502'; end if;
  select application_id into app_id from public.application_revisions where application_revisions.id = p_revision_id;
  if not found then raise exception 'Submission not found.' using errcode = 'P0002'; end if;
  -- Keep the publishing functions' application-then-revision lock order.
  select * into a from public.applications where applications.id = app_id for update;
  if not found then raise exception 'Application not found.' using errcode = 'P0002'; end if;
  select * into r from public.application_revisions where application_revisions.id = p_revision_id for update;
  if not found then raise exception 'Submission not found.' using errcode = 'P0002'; end if;
  if r.status <> 'pending_review' or r.version is distinct from p_expected_version
     or a.status not in ('pending_review', 'published') then
    raise exception 'Submission changed or is no longer pending.' using errcode = '40001';
  end if;
  perform public.approve_application_revision(p_revision_id);
  update public.application_revisions set reviewed_by = p_admin_user_id, reviewed_at = now()
    where application_revisions.id = p_revision_id;
  return query select applications.id, applications.slug, applications.status from public.applications where applications.id = app_id;
end $$;

revoke all on function public.admin_approve_application_revision(uuid,integer,uuid) from public, anon, authenticated;
grant execute on function public.admin_approve_application_revision(uuid,integer,uuid) to service_role;

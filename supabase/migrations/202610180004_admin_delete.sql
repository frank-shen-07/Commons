-- Hard deletion uses the existing foreign-key cascades and the publishers' lock order.
create function public.admin_delete_application(
  p_application_id uuid, p_confirm_slug text, p_expected_updated_at timestamptz
) returns table(id uuid, slug text)
language plpgsql security definer set search_path = '' as $$
declare a public.applications;
begin
  select * into a from public.applications where applications.id = p_application_id for update;
  if not found then raise exception 'Application not found.' using errcode = 'P0002'; end if;
  if a.slug is distinct from p_confirm_slug or a.updated_at is distinct from p_expected_updated_at then
    raise exception 'Application changed. Look it up again before deleting.' using errcode = '40001';
  end if;
  delete from public.applications where applications.id = a.id;
  return query select a.id, a.slug;
end $$;

revoke all on function public.admin_delete_application(uuid,text,timestamptz) from public, anon, authenticated;
grant execute on function public.admin_delete_application(uuid,text,timestamptz) to service_role;

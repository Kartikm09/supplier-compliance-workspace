-- Resolve finding-event visibility through a narrowly scoped definer helper.
-- The base findings table remains unavailable to browser roles.

create or replace function public.buyer_can_view_finding(
  target_finding_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.findings finding
    where finding.id = target_finding_id
      and public.buyer_can_access_relationship(finding.supplier_relationship_id)
  )
$$;

revoke all on function public.buyer_can_view_finding(uuid) from public;
grant execute on function public.buyer_can_view_finding(uuid) to authenticated;

drop policy if exists finding_events_read_visible on public.finding_events;
create policy finding_events_read_visible
on public.finding_events for select to authenticated
using (
  public.buyer_can_view_finding(finding_id)
  or (
    supplier_visible
    and public.can_view_finding(finding_id)
  )
);

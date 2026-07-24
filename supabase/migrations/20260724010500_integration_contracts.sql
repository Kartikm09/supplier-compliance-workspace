-- Contracts shared by the browser, Edge Functions, and durable queue worker.

create or replace function public.accept_supplier_invitation_with_setup(
  invitation_token_prefix text,
  invitation_token_hash text,
  target_supplier_organization_id uuid,
  new_supplier_legal_name text,
  new_supplier_display_name text,
  new_supplier_slug text,
  new_supplier_country_code text,
  request_correlation_id uuid
)
returns public.supplier_relationships
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  invitation_record public.supplier_invitations;
  supplier_organization public.organizations;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select *
  into invitation_record
  from public.supplier_invitations invitation
  where invitation.token_prefix = $1
    and invitation.invitation_token_hash = $2
  for update;

  if invitation_record.id is null
    or invitation_record.status <> 'pending'
    or invitation_record.expires_at <= now() then
    raise exception 'invitation is invalid, expired, or already used'
      using errcode = '22023';
  end if;
  if public.request_email() is distinct from invitation_record.invited_email then
    raise exception 'invitation email does not match authenticated user'
      using errcode = '42501';
  end if;
  if (target_supplier_organization_id is null) = (new_supplier_display_name is null) then
    raise exception 'select an existing supplier or provide a new supplier'
      using errcode = '22023';
  end if;

  if target_supplier_organization_id is null then
    supplier_organization := public.create_organization_with_owner(
      'supplier',
      new_supplier_legal_name,
      new_supplier_display_name,
      new_supplier_slug,
      new_supplier_country_code
    );
    target_supplier_organization_id := supplier_organization.id;
  elsif not public.is_supplier_manager(target_supplier_organization_id) then
    raise exception 'supplier owner or administrator required'
      using errcode = '42501';
  end if;

  perform coalesce(request_correlation_id, gen_random_uuid());
  -- The base workflow performs the locked status transition, relationship
  -- creation, membership validation, notifications, and dual audit records.
  return public.accept_supplier_invitation(
    invitation_token_hash,
    target_supplier_organization_id
  );
end;
$$;

create or replace function public.transition_assessment(
  p_assessment_id uuid,
  p_expected_status text,
  p_next_status text
)
returns public.assessments
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  assessment_record public.assessments;
  relationship_record public.supplier_relationships;
begin
  select *
  into assessment_record
  from public.assessments
  where id = p_assessment_id
  for update;

  if assessment_record.id is null then
    raise exception 'assessment not found' using errcode = 'P0002';
  end if;
  if assessment_record.status <> p_expected_status then
    raise exception 'assessment status changed before this operation'
      using errcode = '40001';
  end if;

  if p_next_status = 'under_review' then
    return public.start_assessment_review(p_assessment_id);
  end if;
  if p_expected_status <> 'draft' or p_next_status <> 'in_progress' then
    raise exception 'unsupported assessment transition'
      using errcode = '22023';
  end if;
  if not public.can_edit_assessment(p_assessment_id) then
    raise exception 'assessment update is not authorized'
      using errcode = '42501';
  end if;

  select *
  into relationship_record
  from public.supplier_relationships
  where id = assessment_record.supplier_relationship_id;

  update public.assessments
  set status = 'in_progress', started_at = coalesce(started_at, now())
  where id = p_assessment_id
  returning * into assessment_record;

  perform public.record_audit_event(
    relationship_record.supplier_organization_id,
    relationship_record.id,
    relationship_record.supplier_organization_id,
    'assessment.started',
    'assessment',
    assessment_record.id,
    jsonb_build_object('status', p_expected_status),
    jsonb_build_object('status', p_next_status)
  );
  return assessment_record;
end;
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns public.notifications
language sql
security definer
set search_path = pg_catalog, public
as $$
  select public.mark_notification(p_notification_id, 'read')
$$;

create or replace function public.request_assessment_report(
  target_assessment_id uuid,
  request_correlation_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, pgmq
as $$
declare
  message_id bigint;
begin
  if not public.can_review_assessment(target_assessment_id) then
    raise exception 'assessment report request is not authorized'
      using errcode = '42501';
  end if;
  select pgmq.send(
    'report_generation',
    jsonb_build_object(
      'assessment_id', target_assessment_id,
      'correlation_id', coalesce(request_correlation_id, gen_random_uuid())
    )
  ) into message_id;
  return message_id;
end;
$$;

create or replace function public.process_notification_job(
  target_notification_id uuid,
  request_correlation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.notifications where id = target_notification_id
  ) then
    raise exception 'notification not found' using errcode = 'P0002';
  end if;
  perform coalesce(request_correlation_id, gen_random_uuid());
  -- The public reference implementation has no external email provider.
  -- Successful validation is enough to archive the durable delivery job while
  -- retaining the in-app notification as the authoritative record.
  return true;
end;
$$;

create table public.generated_assessment_reports (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  supplier_relationship_id uuid not null
    references public.supplier_relationships(id) on delete restrict,
  storage_path text not null unique check (
    storage_path !~ '(^|/)\.\.(/|$)'
    and storage_path !~ '^/'
  ),
  byte_size bigint not null check (byte_size between 1 and 5242880),
  sha256_hash text not null check (sha256_hash ~ '^[a-f0-9]{64}$'),
  generated_at timestamptz not null default now()
);

create index generated_assessment_reports_assessment_idx
  on public.generated_assessment_reports(assessment_id, generated_at desc);

alter table public.generated_assessment_reports enable row level security;
alter table public.generated_assessment_reports force row level security;

create policy generated_assessment_reports_read_participants
on public.generated_assessment_reports for select to authenticated
using (public.can_view_assessment(assessment_id));

revoke all on table public.generated_assessment_reports from public, anon, authenticated;
grant select on table public.generated_assessment_reports to authenticated;
grant all on table public.generated_assessment_reports to service_role;

revoke all on function public.accept_supplier_invitation_with_setup(
  text, text, uuid, text, text, text, text, uuid
) from public, anon;
revoke all on function public.transition_assessment(uuid, text, text)
  from public, anon;
revoke all on function public.mark_notification_read(uuid)
  from public, anon;
revoke all on function public.request_assessment_report(uuid, uuid)
  from public, anon;
revoke all on function public.process_notification_job(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.accept_supplier_invitation_with_setup(
  text, text, uuid, text, text, text, text, uuid
) to authenticated;
grant execute on function public.transition_assessment(uuid, text, text)
  to authenticated;
grant execute on function public.mark_notification_read(uuid)
  to authenticated;
grant execute on function public.request_assessment_report(uuid, uuid)
  to authenticated;
grant execute on function public.process_notification_job(uuid, uuid)
  to service_role;

-- Compact private Broadcast invalidations. Payloads contain identifiers and
-- state only; clients refetch authorized records as the source of truth.

create or replace function public.broadcast_compliance_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, realtime
as $$
declare
  row_data jsonb;
  target_resource_id uuid;
  target_relationship_id uuid;
  buyer_organization_id uuid;
  supplier_organization_id uuid;
  notification_organization_id uuid;
  relationship_topic_suffix text := 'assessment';
  event_name text;
  safe_payload jsonb;
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  target_resource_id := (row_data ->> 'id')::uuid;
  event_name := tg_table_name || '.' || lower(tg_op);

  if tg_table_name = 'notifications' then
    notification_organization_id := (row_data ->> 'organization_id')::uuid;
  elsif tg_table_name = 'supplier_relationships' then
    target_relationship_id := target_resource_id;
    buyer_organization_id := (row_data ->> 'buyer_organization_id')::uuid;
    supplier_organization_id := (row_data ->> 'supplier_organization_id')::uuid;
  elsif tg_table_name = 'assessments' then
    target_relationship_id := (row_data ->> 'supplier_relationship_id')::uuid;
  elsif tg_table_name = 'documents' then
    target_relationship_id := (row_data ->> 'supplier_relationship_id')::uuid;
  elsif tg_table_name = 'document_versions' then
    select document.supplier_relationship_id
    into target_relationship_id
    from public.documents document
    where document.id = (row_data ->> 'document_id')::uuid;
  elsif tg_table_name in ('document_reviews', 'review_tasks', 'risk_evaluations') then
    select assessment.supplier_relationship_id
    into target_relationship_id
    from public.assessments assessment
    where assessment.id = (row_data ->> 'assessment_id')::uuid;
  elsif tg_table_name = 'findings' then
    target_relationship_id := (row_data ->> 'supplier_relationship_id')::uuid;
    relationship_topic_suffix := 'findings';
  elsif tg_table_name = 'finding_events' then
    select finding.supplier_relationship_id
    into target_relationship_id
    from public.findings finding
    where finding.id = (row_data ->> 'finding_id')::uuid;
    relationship_topic_suffix := 'findings';
  elsif tg_table_name = 'corrective_actions' then
    select finding.supplier_relationship_id
    into target_relationship_id
    from public.findings finding
    where finding.id = (row_data ->> 'finding_id')::uuid;
    relationship_topic_suffix := 'findings';
  elsif tg_table_name in ('approval_decisions', 'generated_assessment_reports') then
    select assessment.supplier_relationship_id
    into target_relationship_id
    from public.assessments assessment
    where assessment.id = (row_data ->> 'assessment_id')::uuid;
  end if;

  safe_payload := jsonb_build_object(
    'resource_type', tg_table_name,
    'resource_id', target_resource_id,
    'operation', lower(tg_op)
  );

  if notification_organization_id is not null then
    perform realtime.send(
      safe_payload,
      event_name,
      format('organization:%s:notifications', notification_organization_id),
      true
    );
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if target_relationship_id is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if buyer_organization_id is null or supplier_organization_id is null then
    select
      relationship.buyer_organization_id,
      relationship.supplier_organization_id
    into buyer_organization_id, supplier_organization_id
    from public.supplier_relationships relationship
    where relationship.id = target_relationship_id;
  end if;

  safe_payload := safe_payload
    || jsonb_build_object('relationship_id', target_relationship_id);

  perform realtime.send(
    safe_payload,
    event_name,
    format('relationship:%s:%s', target_relationship_id, relationship_topic_suffix),
    true
  );
  perform realtime.send(
    safe_payload,
    event_name,
    format('buyer:%s:relationships', buyer_organization_id),
    true
  );
  perform realtime.send(
    safe_payload,
    event_name,
    format('organization:%s:notifications', supplier_organization_id),
    true
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.broadcast_compliance_change()
  from public, anon, authenticated;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'supplier_relationships',
    'assessments',
    'documents',
    'document_versions',
    'document_reviews',
    'review_tasks',
    'findings',
    'finding_events',
    'corrective_actions',
    'risk_evaluations',
    'approval_decisions',
    'notifications',
    'generated_assessment_reports'
  ]
  loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I '
      'for each row execute function public.broadcast_compliance_change()',
      target_table || '_private_broadcast',
      target_table
    );
  end loop;
end;
$$;

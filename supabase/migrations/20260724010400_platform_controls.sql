-- Private Storage, private Realtime Broadcast, durable queues, and scheduled jobs.

create or replace function public.safe_uuid(candidate text)
returns uuid
language plpgsql
immutable
strict
set search_path = pg_catalog
as $$
begin
  if candidate !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return null;
  end if;
  return candidate::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create or replace function public.can_read_relationship_storage_path(object_name text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select object_name !~ '(^|/)\.\.(/|$)'
    and exists (
      select 1
      from public.supplier_relationships relationship
      where relationship.id = public.safe_uuid(split_part(object_name, '/', 2))
        and relationship.buyer_organization_id =
          public.safe_uuid(split_part(object_name, '/', 1))
        and public.can_access_relationship(relationship.id)
    )
$$;

create or replace function public.can_upload_evidence_path(object_name text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select object_name !~ '(^|/)\.\.(/|$)'
    and exists (
      select 1
      from public.document_versions version
      join public.documents document on document.id = version.document_id
      join public.supplier_relationships relationship
        on relationship.id = document.supplier_relationship_id
      where version.storage_path = object_name
        and version.upload_status = 'pending_upload'
        and version.uploaded_by = auth.uid()
        and relationship.id = public.safe_uuid(split_part(object_name, '/', 2))
        and relationship.buyer_organization_id =
          public.safe_uuid(split_part(object_name, '/', 1))
        and public.supplier_can_access_relationship(relationship.id)
        and public.has_any_org_role(
          relationship.supplier_organization_id,
          array['supplier_owner', 'supplier_admin', 'supplier_contributor']
        )
    )
$$;

create or replace function public.can_read_evidence_path(object_name text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select object_name !~ '(^|/)\.\.(/|$)'
    and exists (
      select 1
      from public.document_versions version
      join public.documents document on document.id = version.document_id
      where version.storage_path = object_name
        and public.can_view_document(document.id)
    )
$$;

create or replace function public.can_access_profile_asset_path(object_name text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select object_name !~ '(^|/)\.\.(/|$)'
    and public.is_org_member(public.safe_uuid(split_part(object_name, '/', 1)))
$$;

create or replace function public.can_write_profile_asset_path(object_name text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.can_access_profile_asset_path(object_name)
    and public.safe_uuid(split_part(object_name, '/', 2)) = auth.uid()
$$;

create or replace function public.can_use_realtime_topic(target_topic text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case split_part(target_topic, ':', 1)
    when 'buyer' then
      split_part(target_topic, ':', 3) = 'relationships'
      and split_part(target_topic, ':', 4) = ''
      and public.is_org_member(public.safe_uuid(split_part(target_topic, ':', 2)))
      and public.org_type(public.safe_uuid(split_part(target_topic, ':', 2))) = 'buyer'
    when 'relationship' then
      split_part(target_topic, ':', 3) in ('assessment', 'findings')
      and split_part(target_topic, ':', 4) = ''
      and public.can_access_relationship(
        public.safe_uuid(split_part(target_topic, ':', 2))
      )
    when 'organization' then
      split_part(target_topic, ':', 3) = 'notifications'
      and split_part(target_topic, ':', 4) = ''
      and public.is_org_member(public.safe_uuid(split_part(target_topic, ':', 2)))
    else false
  end
$$;

do $$
declare
  function_signature text;
begin
  foreach function_signature in array array[
    'public.can_read_relationship_storage_path(text)',
    'public.can_upload_evidence_path(text)',
    'public.can_read_evidence_path(text)',
    'public.can_access_profile_asset_path(text)',
    'public.can_write_profile_asset_path(text)',
    'public.can_use_realtime_topic(text)'
  ]
  loop
    execute format('revoke all on function %s from public', function_signature);
    execute format('grant execute on function %s to authenticated', function_signature);
  end loop;
end;
$$;

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) values
  (
    'supplier-evidence',
    'supplier-evidence',
    false,
    10485760,
    array['application/pdf', 'text/plain', 'image/png', 'image/jpeg']
  ),
  (
    'assessment-reports',
    'assessment-reports',
    false,
    5242880,
    array['application/pdf']
  ),
  (
    'profile-assets',
    'profile-assets',
    false,
    2097152,
    array['image/png', 'image/jpeg']
  )
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy supplier_evidence_read_participants
on storage.objects for select to authenticated
using (
  bucket_id = 'supplier-evidence'
  and public.can_read_evidence_path(name)
);

create policy supplier_evidence_upload_contributors
on storage.objects for insert to authenticated
with check (
  bucket_id = 'supplier-evidence'
  and public.can_upload_evidence_path(name)
);

create policy assessment_reports_read_participants
on storage.objects for select to authenticated
using (
  bucket_id = 'assessment-reports'
  and public.can_read_relationship_storage_path(name)
);

create policy profile_assets_read_organization
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-assets'
  and public.can_access_profile_asset_path(name)
);

create policy profile_assets_insert_self
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-assets'
  and public.can_write_profile_asset_path(name)
);

create policy profile_assets_update_self
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-assets'
  and public.can_write_profile_asset_path(name)
)
with check (
  bucket_id = 'profile-assets'
  and public.can_write_profile_asset_path(name)
);

create policy profile_assets_delete_self
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-assets'
  and public.can_write_profile_asset_path(name)
);

-- Broadcast authorization is topic-scoped. Messages carry compact invalidation
-- metadata only; clients refetch authoritative records after reconnecting.
create policy compliance_broadcast_receive
on realtime.messages for select to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and public.can_use_realtime_topic(realtime.topic())
);

create policy compliance_broadcast_send
on realtime.messages for insert to authenticated
with check (
  realtime.messages.extension = 'broadcast'
  and public.can_use_realtime_topic(realtime.topic())
);

select pgmq.create('document_processing')
where not exists (
  select 1 from pgmq.list_queues() where queue_name = 'document_processing'
);
select pgmq.create('risk_recalculation')
where not exists (
  select 1 from pgmq.list_queues() where queue_name = 'risk_recalculation'
);
select pgmq.create('report_generation')
where not exists (
  select 1 from pgmq.list_queues() where queue_name = 'report_generation'
);
select pgmq.create('notification_delivery')
where not exists (
  select 1 from pgmq.list_queues() where queue_name = 'notification_delivery'
);
select pgmq.create('document_processing_dead_letter')
where not exists (
  select 1 from pgmq.list_queues() where queue_name = 'document_processing_dead_letter'
);
select pgmq.create('risk_recalculation_dead_letter')
where not exists (
  select 1 from pgmq.list_queues() where queue_name = 'risk_recalculation_dead_letter'
);
select pgmq.create('report_generation_dead_letter')
where not exists (
  select 1 from pgmq.list_queues() where queue_name = 'report_generation_dead_letter'
);
select pgmq.create('notification_delivery_dead_letter')
where not exists (
  select 1 from pgmq.list_queues() where queue_name = 'notification_delivery_dead_letter'
);

create or replace function public.enqueue_notification_delivery()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pgmq
as $$
begin
  perform pgmq.send(
    'notification_delivery',
    jsonb_build_object(
      'notification_id', new.id,
      'organization_id', new.organization_id,
      'notification_type', new.notification_type,
      'correlation_id', gen_random_uuid()
    )
  );
  return new;
end;
$$;

create trigger notifications_enqueue_delivery
after insert on public.notifications
for each row execute function public.enqueue_notification_delivery();

create or replace function public.read_compliance_jobs(
  queue_name text,
  visibility_timeout_seconds integer default 120,
  batch_size integer default 10
)
returns setof jsonb
language plpgsql
security definer
set search_path = pg_catalog, pgmq
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if queue_name not in (
    'document_processing',
    'risk_recalculation',
    'report_generation',
    'notification_delivery'
  ) then
    raise exception 'unknown compliance queue' using errcode = '22023';
  end if;
  if visibility_timeout_seconds not between 15 and 900
    or batch_size not between 1 and 50 then
    raise exception 'queue read bounds are invalid' using errcode = '22023';
  end if;
  return query execute format(
    'select to_jsonb(message_row) from pgmq.read(%L, %s, %s) message_row',
    queue_name,
    visibility_timeout_seconds,
    batch_size
  );
end;
$$;

create or replace function public.archive_compliance_job(
  queue_name text,
  message_id bigint
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, pgmq
as $$
declare
  archived boolean;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if queue_name not in (
    'document_processing',
    'risk_recalculation',
    'report_generation',
    'notification_delivery'
  ) then
    raise exception 'unknown compliance queue' using errcode = '22023';
  end if;
  execute format('select pgmq.archive(%L, $1)', queue_name)
  into archived
  using message_id;
  return archived;
end;
$$;

create or replace function public.dead_letter_compliance_job(
  queue_name text,
  message_id bigint,
  payload jsonb,
  failure_code text,
  attempt_count integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, pgmq
as $$
declare
  deleted boolean;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if queue_name not in (
    'document_processing',
    'risk_recalculation',
    'report_generation',
    'notification_delivery'
  ) then
    raise exception 'unknown compliance queue' using errcode = '22023';
  end if;
  if attempt_count < 1 then
    raise exception 'attempt count must be positive' using errcode = '22023';
  end if;

  perform pgmq.send(
    queue_name || '_dead_letter',
    jsonb_build_object(
      'original_message_id', message_id,
      'payload', payload,
      'failure_code', left(coalesce(failure_code, 'unknown'), 200),
      'attempt_count', attempt_count,
      'dead_lettered_at', now()
    )
  );
  execute format('select pgmq.delete(%L, $1)', queue_name)
  into deleted
  using message_id;
  return deleted;
end;
$$;

revoke all on function public.read_compliance_jobs(text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.archive_compliance_job(text, bigint)
  from public, anon, authenticated;
revoke all on function public.dead_letter_compliance_job(text, bigint, jsonb, text, integer)
  from public, anon, authenticated;
grant execute on function public.read_compliance_jobs(text, integer, integer) to service_role;
grant execute on function public.archive_compliance_job(text, bigint) to service_role;
grant execute on function public.dead_letter_compliance_job(
  text, bigint, jsonb, text, integer
) to service_role;

-- Daily document reminders. A seven-day deduplication window keeps reruns
-- idempotent without relying on an external mail provider.
select cron.schedule(
  'scw-document-expiry-reminders',
  '15 6 * * *',
  $$
    insert into public.notifications (
      organization_id,
      related_resource_type,
      related_resource_id,
      notification_type,
      title,
      body
    )
    select
      relationship.supplier_organization_id,
      'document',
      document.id,
      'document.expiring',
      'Supplier document expires soon',
      'A fictional supplier evidence document expires within 30 days.'
    from public.document_versions version
    join public.documents document on document.current_version_id = version.id
    join public.supplier_relationships relationship
      on relationship.id = document.supplier_relationship_id
    where version.upload_status = 'ready'
      and version.expiry_date between current_date and current_date + 30
      and not exists (
        select 1
        from public.notifications notification
        where notification.organization_id = relationship.supplier_organization_id
          and notification.related_resource_type = 'document'
          and notification.related_resource_id = document.id
          and notification.notification_type = 'document.expiring'
          and notification.created_at > now() - interval '7 days'
      );
  $$
);

select cron.schedule(
  'scw-overdue-work-reminders',
  '40 */6 * * *',
  $$
    insert into public.notifications (
      organization_id,
      user_id,
      related_resource_type,
      related_resource_id,
      notification_type,
      title,
      body
    )
    select
      task.buyer_organization_id,
      task.assigned_to,
      'assessment',
      task.assessment_id,
      'review.overdue',
      'Supplier assessment review is overdue',
      'An assigned fictional assessment review has passed its due date.'
    from public.review_tasks task
    where task.status in ('pending', 'in_progress')
      and task.due_at < now()
      and not exists (
        select 1 from public.notifications notification
        where notification.organization_id = task.buyer_organization_id
          and notification.user_id = task.assigned_to
          and notification.related_resource_type = 'assessment'
          and notification.related_resource_id = task.assessment_id
          and notification.notification_type = 'review.overdue'
          and notification.created_at > now() - interval '24 hours'
      );
  $$
);

select cron.schedule(
  'scw-invitation-expiry',
  '20 * * * *',
  $$
    update public.supplier_invitations
    set status = 'expired'
    where status = 'pending'
      and expires_at <= now();
  $$
);

select cron.schedule(
  'scw-abandoned-upload-review',
  '35 3 * * *',
  $$
    update public.document_versions
    set
      upload_status = 'rejected',
      processing_status = 'failed',
      processing_error = 'abandoned_upload'
    where upload_status = 'pending_upload'
      and uploaded_at is null
      and created_at < now() - interval '24 hours'
      and id in (
        select version.id
        from public.document_versions version
        where version.upload_status = 'pending_upload'
          and version.uploaded_at is null
          and version.created_at < now() - interval '24 hours'
          and version.id not in (
            select current_version_id
            from public.documents
            where current_version_id is not null
          )
      );
  $$
);

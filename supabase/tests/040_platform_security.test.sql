begin;

create extension if not exists pgtap with schema extensions;
select plan(41);

create temporary table platform_test_ids (
  key text primary key,
  uuid_value uuid,
  bigint_value bigint
);
grant select, insert, update on platform_test_ids to authenticated, service_role;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee0',
  'authenticated',
  'authenticated',
  'owner@delta-supplier.invalid',
  null,
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Delta Owner"}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
);
insert into public.organizations (
  id, organization_type, legal_name, display_name, slug, country_code, created_by
) values (
  '55555555-5555-4555-8555-555555555555',
  'supplier',
  'Delta Supplier Demonstration Ltd.',
  'Delta Supplier',
  'delta-supplier',
  'FR',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee0'
);
insert into public.organization_members (
  id, organization_id, user_id, role, membership_status, joined_at
) values (
  '55000000-0000-4000-8000-000000000001',
  '55555555-5555-4555-8555-555555555555',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee0',
  'supplier_owner',
  'active',
  now()
);
insert into public.supplier_profiles (supplier_organization_id)
values ('55555555-5555-4555-8555-555555555555');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
insert into platform_test_ids (key, uuid_value)
select
  'invitation',
  invitation.id
from public.create_supplier_invitation(
  '11111111-1111-4111-8111-111111111111',
  'Delta Supplier',
  'owner@delta-supplier.invalid',
  '2222222222222222222222222222222222222222222222222222222222222222',
  'DELTA001',
  now() + interval '7 days'
) invitation;

select is(
  (
    select status from public.supplier_invitations
    where id = (select uuid_value from platform_test_ids where key = 'invitation')
  ),
  'pending',
  'buyer administrator creates a pending hashed invitation'
);
select ok(
  not exists (
    select 1
    from public.audit_events
    where resource_id = (select uuid_value from platform_test_ids where key = 'invitation')
      and (
        old_values ? 'invitation_token_hash'
        or new_values ? 'invitation_token_hash'
        or old_values ? 'token'
        or new_values ? 'token'
      )
  ),
  'invitation audit record excludes token material'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee0', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.email', 'owner@delta-supplier.invalid', true);
insert into platform_test_ids (key, uuid_value)
select
  'relationship',
  relationship.id
from public.accept_supplier_invitation(
  '2222222222222222222222222222222222222222222222222222222222222222',
  '55555555-5555-4555-8555-555555555555'
) relationship;

select is(
  (
    select relationship_status
    from public.supplier_relationships
    where id = (select uuid_value from platform_test_ids where key = 'relationship')
  ),
  'active',
  'supplier owner accepts invitation into an active relationship'
);
select is(
  (
    select status
    from public.supplier_invitations
    where id = (select uuid_value from platform_test_ids where key = 'invitation')
  ),
  null,
  'supplier cannot directly read invitation record after acceptance'
);
select throws_ok(
  $$
    select public.accept_supplier_invitation(
      '2222222222222222222222222222222222222222222222222222222222222222',
      '55555555-5555-4555-8555-555555555555'
    )
  $$,
  '22023',
  'invitation is no longer pending',
  'accepted invitation cannot be reused'
);
select is(
  (
    select count(*)
    from public.supplier_relationships
    where buyer_organization_id = '11111111-1111-4111-8111-111111111111'
      and supplier_organization_id = '55555555-5555-4555-8555-555555555555'
  ),
  1::bigint,
  'invitation acceptance creates exactly one relationship'
);
select ok(
  public.supplier_can_access_relationship(
    (select uuid_value from platform_test_ids where key = 'relationship')
  ),
  'new supplier relationship is immediately authorized'
);
select is(
  (select count(*) from public.organizations),
  2::bigint,
  'new supplier sees only itself and its buyer counterpart'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select ok(
  public.can_read_evidence_path(
    '11111111-1111-4111-8111-111111111111/40000000-0000-4000-8000-000000000001/70000000-0000-4000-8000-000000000001/1/business-registration-demo.pdf'
  ),
  'Nova contributor may read an exact Nova evidence path'
);
select ok(
  not public.can_read_relationship_storage_path(
    '11111111-1111-4111-8111-111111111111/40000000-0000-4000-8000-000000000001/../private.txt'
  ),
  'path traversal fails closed'
);
select ok(
  public.can_use_realtime_topic(
    'relationship:40000000-0000-4000-8000-000000000001:assessment'
  ),
  'Nova member may subscribe to its assessment topic'
);
select ok(
  not public.can_use_realtime_topic(
    'buyer:11111111-1111-4111-8111-111111111111:relationships'
  ),
  'supplier cannot subscribe to buyer-wide relationship topic'
);
select ok(
  public.can_use_realtime_topic(
    'organization:22222222-2222-4222-8222-222222222222:notifications'
  ),
  'supplier may subscribe to its organization notification topic'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select ok(
  public.can_use_realtime_topic(
    'buyer:11111111-1111-4111-8111-111111111111:relationships'
  ),
  'buyer member may subscribe to buyer relationship topic'
);
select ok(
  public.can_use_realtime_topic(
    'relationship:40000000-0000-4000-8000-000000000002:findings'
  ),
  'buyer member may subscribe to a Greenline finding topic'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc0', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select ok(
  not public.can_use_realtime_topic(
    'relationship:40000000-0000-4000-8000-000000000001:findings'
  ),
  'Greenline cannot subscribe to Nova finding topic'
);
select ok(
  public.can_use_realtime_topic(
    'relationship:40000000-0000-4000-8000-000000000002:findings'
  ),
  'Greenline can subscribe to its own finding topic'
);
reset role;

select is(
  (
    select count(*) from storage.buckets
    where id in ('supplier-evidence', 'assessment-reports', 'profile-assets')
  ),
  3::bigint,
  'three scoped Storage buckets are provisioned'
);
select is(
  (
    select count(*) from storage.buckets
    where id in ('supplier-evidence', 'assessment-reports', 'profile-assets')
      and not public
  ),
  3::bigint,
  'all portfolio Storage buckets are private'
);
select is(
  (
    select file_size_limit from storage.buckets
    where id = 'supplier-evidence'
  ),
  10485760::bigint,
  'supplier evidence bucket enforces a ten-megabyte ceiling'
);
select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'storage'
      and policyname in (
        'supplier_evidence_read_participants',
        'supplier_evidence_upload_contributors',
        'assessment_reports_read_participants',
        'profile_assets_read_organization',
        'profile_assets_insert_self',
        'profile_assets_update_self',
        'profile_assets_delete_self'
      )
  ),
  7,
  'Storage policies cover read, controlled upload, and profile ownership'
);
select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and policyname like 'supplier_evidence%delete%'
  ),
  'authenticated users have no direct evidence deletion policy'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'realtime'
      and policyname = 'compliance_broadcast_receive'
      and cmd = 'SELECT'
  ),
  'private Realtime receive policy exists'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'realtime'
      and policyname = 'compliance_broadcast_send'
      and cmd = 'INSERT'
  ),
  'private Realtime send policy exists'
);
select is(
  (
    select count(*)::integer
    from pgmq.list_queues()
    where queue_name in (
      'document_processing',
      'risk_recalculation',
      'report_generation',
      'notification_delivery',
      'document_processing_dead_letter',
      'risk_recalculation_dead_letter',
      'report_generation_dead_letter',
      'notification_delivery_dead_letter'
    )
  ),
  8,
  'four primary and four dead-letter queues are provisioned'
);
select is(
  (
    select count(*)::integer
    from pgmq.list_queues()
    where queue_name in (
      'document_processing',
      'risk_recalculation',
      'report_generation',
      'notification_delivery'
    )
  ),
  4,
  'all four durable processing queues exist'
);
select ok(
  exists (
    select 1
    from pgmq.q_notification_delivery
    where message->>'notification_id' = '90000000-0000-4000-8000-000000000001'
      and message ? 'correlation_id'
      and not (message ? 'body')
  ),
  'notification trigger enqueues only bounded delivery metadata'
);
select is(
  (
    select count(*)::integer
    from pgmq.list_queues()
    where queue_name like '%\_dead\_letter' escape '\'
  ),
  4,
  'every processing queue has a dead-letter queue'
);
select is(
  (
    select count(*)::integer from cron.job
    where jobname in (
      'scw-document-expiry-reminders',
      'scw-overdue-work-reminders',
      'scw-invitation-expiry',
      'scw-abandoned-upload-review'
    )
  ),
  4,
  'four low-frequency scheduled maintenance jobs exist'
);
select ok(
  (
    select bool_and(schedule not in ('* * * * *', '*/1 * * * *'))
    from cron.job
    where jobname like 'scw-%'
  ),
  'scheduled jobs avoid per-minute resource use'
);
select ok(
  (
    select allowed_mime_types @> array['application/pdf']::text[]
    from storage.buckets
    where id = 'supplier-evidence'
  ),
  'supplier evidence permits constrained PDF fixtures'
);
select is(
  (
    select allowed_mime_types
    from storage.buckets
    where id = 'assessment-reports'
  ),
  array['application/pdf']::text[],
  'generated report bucket accepts PDF only'
);
select is(
  (
    select file_size_limit from storage.buckets
    where id = 'profile-assets'
  ),
  2097152::bigint,
  'profile assets have a two-megabyte ceiling'
);
select is(
  (
    select schedule from cron.job
    where jobname = 'scw-invitation-expiry'
  ),
  '20 * * * *',
  'invitation expiry runs hourly rather than continuously'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select throws_ok(
  $$ select public.enqueue_compliance_job('notification_delivery', '{"kind":"unauthorized"}') $$,
  '42501',
  'permission denied for function enqueue_compliance_job',
  'browser user cannot enqueue privileged jobs'
);
select throws_ok(
  $$ select * from public.read_compliance_jobs('notification_delivery', 30, 1) $$,
  '42501',
  'permission denied for function read_compliance_jobs',
  'browser user cannot read queue payloads'
);
reset role;

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
insert into platform_test_ids (key, bigint_value)
values (
  'archive_job',
  public.enqueue_compliance_job(
    'notification_delivery',
    '{"kind":"pgtap-archive","synthetic":true}'::jsonb
  )
);
select ok(
  exists (
    select 1
    from public.read_compliance_jobs('notification_delivery', 30, 10) job
    where job->'message'->>'kind' = 'pgtap-archive'
  ),
  'service worker reads queue messages with visibility timeout'
);
select ok(
  public.archive_compliance_job(
    'notification_delivery',
    (select bigint_value from platform_test_ids where key = 'archive_job')
  ),
  'successful queue job is archived explicitly'
);

insert into platform_test_ids (key, bigint_value)
values (
  'dead_letter_job',
  public.enqueue_compliance_job(
    'notification_delivery',
    '{"kind":"pgtap-dead-letter","synthetic":true}'::jsonb
  )
);
select ok(
  public.dead_letter_compliance_job(
    'notification_delivery',
    (select bigint_value from platform_test_ids where key = 'dead_letter_job'),
    '{"kind":"pgtap-dead-letter","synthetic":true}'::jsonb,
    'synthetic_failure',
    5
  ),
  'repeatedly failing job moves to dead-letter handling'
);
reset role;

select ok(
  exists (
    select 1
    from pgmq.q_notification_delivery_dead_letter
    where message->>'failure_code' = 'synthetic_failure'
      and (message->>'attempt_count')::integer = 5
  ),
  'dead-letter queue preserves bounded failure context'
);
select is(
  public.sanitize_audit_json(
    '{"token":"remove","password":"remove","safe":"keep"}'::jsonb
  ),
  '{"safe":"keep"}'::jsonb,
  'audit sanitizer strips common secret-bearing keys'
);

select * from finish();
rollback;

begin;

create extension if not exists pgtap with schema extensions;
select plan(40);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000',
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd0',
  'authenticated',
  'authenticated',
  'owner@orion-buyer.invalid',
  null,
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Orion Owner"}'::jsonb,
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
  '44444444-4444-4444-8444-444444444444',
  'buyer',
  'Orion Buyer Demonstration Ltd.',
  'Orion Buyer',
  'orion-buyer',
  'GB',
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd0'
);
insert into public.organization_members (
  id, organization_id, user_id, role, membership_status, joined_at
) values (
  '44000000-0000-4000-8000-000000000001',
  '44444444-4444-4444-8444-444444444444',
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd0',
  'buyer_owner',
  'active',
  now()
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$ select count(*) from public.organizations $$,
  '42501',
  'permission denied for table organizations',
  'anonymous users cannot read organizations'
);
select throws_ok(
  $$ select count(*) from public.findings_visible $$,
  '42501',
  'permission denied for view findings_visible',
  'anonymous users cannot read supplier-safe views'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is((select count(*) from public.organizations), 3::bigint, 'Apex reviewer sees Apex and its two supplier counterparts');
select is((select count(*) from public.supplier_relationships), 2::bigint, 'Apex reviewer sees both Apex supplier relationships');
select is((select count(*) from public.assessments), 1::bigint, 'Apex reviewer sees the Nova assessment');
select isnt(
  (select internal_note from public.findings_visible where id = '80000000-0000-4000-8000-000000000001'),
  null,
  'assigned buyer reviewer sees buyer finding notes'
);
select isnt(
  (select internal_note from public.document_reviews_visible where id = '72000000-0000-4000-8000-000000000002'),
  null,
  'assigned buyer reviewer sees document internal notes'
);
select isnt(
  (select internal_rationale from public.approval_decisions_visible where id = '84000000-0000-4000-8000-000000000001'),
  null,
  'assigned buyer reviewer sees decision rationale'
);
select is((select count(*) from public.risk_evaluations_visible), 1::bigint, 'assigned buyer reviewer sees internal risk evaluation');
select ok(
  public.can_review_assessment('60000000-0000-4000-8000-000000000001'),
  'reviewer helper recognizes the assigned buyer reviewer'
);
select throws_ok(
  $$
    insert into public.audit_events (
      organization_id, action, resource_type
    ) values (
      '11111111-1111-4111-8111-111111111111', 'forged.event', 'assessment'
    )
  $$,
  '42501',
  'permission denied for table audit_events',
  'authenticated users cannot forge audit events'
);
select results_eq(
  $$
    update public.organization_members
    set role = 'buyer_admin'
    where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
    returning role
  $$,
  array[]::text[],
  'buyer reviewer cannot promote their own membership'
);
select results_eq(
  $$
    update public.assessment_responses
    set response_text = 'Buyer-side answer rewrite'
    where id = '61000000-0000-4000-8000-000000000001'
    returning id::text
  $$,
  array[]::text[],
  'buyer reviewer cannot modify supplier questionnaire answers'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is((select count(*) from public.organizations), 2::bigint, 'Nova contributor sees only Nova and Apex');
select is((select count(*) from public.supplier_relationships), 1::bigint, 'Nova contributor sees only the Nova relationship');
select is((select count(*) from public.assessments), 1::bigint, 'Nova contributor sees its assigned assessment');
select is((select count(*) from public.documents), 4::bigint, 'Nova contributor sees Nova documents');
select is((select count(*) from public.findings_visible), 1::bigint, 'Nova contributor sees supplier-facing findings');
select is(
  (select internal_note from public.findings_visible where id = '80000000-0000-4000-8000-000000000001'),
  null,
  'supplier-facing finding masks buyer internal note'
);
select is(
  (select internal_note from public.document_reviews_visible where id = '72000000-0000-4000-8000-000000000002'),
  null,
  'supplier-facing document review masks buyer internal note'
);
select is(
  (select internal_rationale from public.approval_decisions_visible where id = '84000000-0000-4000-8000-000000000001'),
  null,
  'supplier-facing decision masks buyer rationale'
);
select is((select count(*) from public.risk_evaluations_visible), 0::bigint, 'supplier cannot read internal risk calculations');
select throws_ok(
  $$ select count(*) from public.findings $$,
  '42501',
  'permission denied for table findings',
  'supplier cannot bypass masked finding view'
);
select throws_ok(
  $$ select count(*) from public.document_reviews $$,
  '42501',
  'permission denied for table document_reviews',
  'supplier cannot bypass masked document review view'
);
select throws_ok(
  $$ select count(*) from public.approval_decisions $$,
  '42501',
  'permission denied for table approval_decisions',
  'supplier cannot bypass masked decision view'
);
select throws_ok(
  $$ select count(*) from public.risk_evaluations $$,
  '42501',
  'permission denied for table risk_evaluations',
  'supplier cannot query risk table directly'
);
select is((select count(*) from public.audit_events), 1::bigint, 'supplier sees only audit events written to its organization');
select throws_ok(
  $$
    select public.record_approval_decision(
      '60000000-0000-4000-8000-000000000001',
      'approved',
      current_date,
      current_date + 365,
      'Unauthorized supplier decision.',
      'Unauthorized supplier rationale.'
    )
  $$,
  '42501',
  'approval decision is not authorized',
  'supplier cannot record a buyer approval decision'
);
select results_eq(
  $$
    update public.assessment_responses
    set response_text = 'Attempted post-decision rewrite'
    where id = '61000000-0000-4000-8000-000000000001'
    returning id::text
  $$,
  array[]::text[],
  'supplier cannot change responses after a terminal decision'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select results_eq(
  $$
    update public.assessment_responses
    set response_text = 'Viewer mutation'
    where id = '61000000-0000-4000-8000-000000000001'
    returning id::text
  $$,
  array[]::text[],
  'supplier viewer cannot mutate assessment responses'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc0', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is((select count(*) from public.supplier_relationships), 1::bigint, 'Greenline sees only its own relationship');
select is((select count(*) from public.assessments), 0::bigint, 'Greenline cannot see the Nova assessment');
select is((select count(*) from public.documents), 0::bigint, 'Greenline cannot see Nova documents');
select is((select count(*) from public.findings_visible), 0::bigint, 'Greenline cannot see Nova findings');
select ok(
  not public.can_read_relationship_storage_path(
    '11111111-1111-4111-8111-111111111111/40000000-0000-4000-8000-000000000001/70000000-0000-4000-8000-000000000001/1/business-registration-demo.pdf'
  ),
  'Greenline cannot authorize a Nova evidence path'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd0', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is((select count(*) from public.organizations), 1::bigint, 'unrelated buyer sees only its own organization');
select is((select count(*) from public.supplier_relationships), 0::bigint, 'unrelated buyer sees no Apex relationships');
select is((select count(*) from public.assessments), 0::bigint, 'unrelated buyer sees no Apex assessments');
reset role;

update public.supplier_relationships
set relationship_status = 'suspended', suspended_at = now()
where id = '40000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb0', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is((select count(*) from public.assessments), 0::bigint, 'suspended supplier immediately loses assessment access');
select ok(
  not public.supplier_can_access_relationship('40000000-0000-4000-8000-000000000001'),
  'suspended relationship fails supplier authorization helper'
);
reset role;

select * from finish();
rollback;

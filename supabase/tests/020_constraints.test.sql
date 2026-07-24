begin;

create extension if not exists pgtap with schema extensions;
select plan(25);

insert into public.program_versions (
  id, qualification_program_id, version_number, status, change_summary
) values (
  '51000000-0000-4000-8000-000000000099',
  '50000000-0000-4000-8000-000000000001',
  99,
  'draft',
  'Constraint-test draft version.'
);

select throws_ok(
  $$
    insert into public.organization_members (
      organization_id, user_id, role, membership_status
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc0',
      'supplier_viewer',
      'active'
    )
  $$,
  '23514',
  'buyer organization requires a buyer role',
  'buyer organizations reject supplier roles'
);

select throws_ok(
  $$
    insert into public.supplier_profiles (
      supplier_organization_id
    ) values (
      '11111111-1111-4111-8111-111111111111'
    )
  $$,
  '23514',
  'supplier profile requires a supplier organization',
  'buyer organization cannot receive a supplier profile'
);

select throws_ok(
  $$
    insert into public.supplier_relationships (
      buyer_organization_id,
      supplier_organization_id,
      buyer_supplier_code
    ) values (
      '22222222-2222-4222-8222-222222222222',
      '11111111-1111-4111-8111-111111111111',
      'INVALID-DIRECTION'
    )
  $$,
  '23514',
  'relationship buyer must be a buyer organization',
  'relationship direction enforces buyer organization type'
);

select throws_ok(
  $$
    insert into public.assessment_responses (
      assessment_id, question_id, response_text, response_number,
      answered_by
    ) values (
      '60000000-0000-4000-8000-000000000001',
      '53000000-0000-4000-8000-000000000001',
      'Two values are invalid',
      10,
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
    )
  $$,
  '23514',
  'exactly one response value is required',
  'response rows accept exactly one typed value'
);

select throws_ok(
  $$
    insert into public.assessment_responses (
      assessment_id, question_id, response_number, answered_by
    ) values (
      '60000000-0000-4000-8000-000000000001',
      '53000000-0000-4000-8000-000000000001',
      10,
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
    )
  $$,
  '23514',
  'text response required for question type long_text',
  'text questions reject numeric answer fields'
);

select throws_ok(
  $$
    update public.assessment_responses
    set response_text = 'Attempted rewrite'
    where id = '61000000-0000-4000-8000-000000000001'
  $$,
  '55000',
  'assessment responses are locked in status conditionally_approved',
  'submitted assessment responses are immutable outside revision state'
);

select throws_ok(
  $$
    update public.assessments
    set program_version_id = '51000000-0000-4000-8000-000000000099'
    where id = '60000000-0000-4000-8000-000000000001'
  $$,
  '55000',
  'assessment relationship and program version are immutable',
  'assessment remains pinned to its original program version'
);

select throws_ok(
  $$
    update public.questions
    set prompt = 'Attempted published-question rewrite'
    where id = '53000000-0000-4000-8000-000000000001'
  $$,
  '55000',
  'published program definitions are immutable',
  'published question cannot be edited'
);

select throws_ok(
  $$
    delete from public.questionnaire_sections
    where id = '52000000-0000-4000-8000-000000000001'
  $$,
  '55000',
  'published program definitions are immutable',
  'published questionnaire section cannot be deleted'
);

select throws_ok(
  $$
    update public.program_versions
    set change_summary = 'Attempted rewrite'
    where id = '51000000-0000-4000-8000-000000000001'
  $$,
  '55000',
  'published program versions are immutable',
  'published version metadata cannot be rewritten'
);

select throws_ok(
  $$
    delete from public.program_versions
    where id = '51000000-0000-4000-8000-000000000001'
  $$,
  '55000',
  'published program versions are immutable',
  'published version cannot be deleted'
);

select throws_ok(
  $$
    update public.document_versions
    set sha256_hash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
    where id = '71000000-0000-4000-8000-000000000001'
  $$,
  '55000',
  'uploaded document version metadata is immutable',
  'uploaded document checksum cannot be rewritten'
);

select throws_ok(
  $$
    update public.document_versions
    set upload_status = 'processing'
    where id = '71000000-0000-4000-8000-000000000001'
  $$,
  '22023',
  'illegal document-version transition: ready -> processing',
  'document state machine rejects backward processing'
);

select throws_ok(
  $$
    update public.audit_events
    set action = 'rewritten'
    where id = '91000000-0000-4000-8000-000000000001'
  $$,
  '55000',
  'audit_events is append-only',
  'audit history cannot be updated'
);

select throws_ok(
  $$
    delete from public.audit_events
    where id = '91000000-0000-4000-8000-000000000001'
  $$,
  '55000',
  'audit_events is append-only',
  'audit history cannot be deleted'
);

select throws_ok(
  $$
    update public.assessment_submission_snapshots
    set declaration = 'Rewritten declaration'
    where id = '62000000-0000-4000-8000-000000000001'
  $$,
  '55000',
  'assessment_submission_snapshots is append-only',
  'submission snapshot cannot be updated'
);

select throws_ok(
  $$
    update public.approval_decisions
    set conditions = 'Rewritten conditions'
    where id = '84000000-0000-4000-8000-000000000001'
  $$,
  '55000',
  'approval_decisions is append-only',
  'approval decision cannot be updated'
);

select throws_ok(
  $$
    update public.risk_evaluations
    set total_score = 0
    where id = '83000000-0000-4000-8000-000000000001'
  $$,
  '55000',
  'historical risk evaluations are immutable',
  'risk result cannot be rewritten'
);

select throws_like(
  $$
    insert into public.document_versions (
      document_id, version_number, storage_path, original_filename,
      sanitized_filename, mime_type, byte_size, sha256_hash, issue_date,
      expiry_date, upload_status, processing_status, uploaded_by, uploaded_at
    ) values (
      '70000000-0000-4000-8000-000000000001',
      99,
      '11111111-1111-4111-8111-111111111111/40000000-0000-4000-8000-000000000001/70000000-0000-4000-8000-000000000001/99/invalid-dates.pdf',
      'invalid-dates.pdf',
      'invalid-dates.pdf',
      'application/pdf',
      100,
      'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      '2026-07-10',
      '2026-07-01',
      'ready',
      'complete',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
      now()
    )
  $$,
  '%violates check constraint%',
  'document expiry cannot precede issue date'
);

select throws_like(
  $$
    insert into public.supplier_invitations (
      buyer_organization_id, intended_supplier_name, invited_email,
      invitation_token_hash, token_prefix, expires_at, created_by
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'Invalid Token Supplier',
      'invalid-token@supplier.invalid',
      'plaintext-token',
      'BADTOKEN',
      now() + interval '7 days',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    )
  $$,
  '%violates check constraint%',
  'invitation token storage requires a one-way hash shape'
);

select throws_like(
  $$
    insert into public.supplier_relationships (
      buyer_organization_id, supplier_organization_id, buyer_supplier_code,
      relationship_status, onboarding_status, accepted_at
    ) values (
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      'DUPLICATE-REL',
      'active',
      'qualification_pending',
      now()
    )
  $$,
  '%duplicate key value violates unique constraint "supplier_relationship_pair_unique"%',
  'duplicate buyer-supplier relationship is rejected'
);

select ok(
  public.is_legal_assessment_transition('draft', 'submitted'),
  'assessment state machine allows draft submission'
);
select ok(
  not public.is_legal_assessment_transition('approved', 'under_review'),
  'assessment state machine rejects terminal rollback'
);
select ok(
  public.is_legal_document_version_transition('processing', 'ready'),
  'document state machine allows successful processing'
);
select ok(
  not public.is_legal_relationship_transition('terminated', 'active'),
  'terminated relationship cannot be reopened'
);

select * from finish();
rollback;

begin;

create extension if not exists pgtap with schema extensions;
select plan(39);

create temporary table workflow_test_ids (
  key text primary key,
  id uuid not null
);
grant select, insert, update on workflow_test_ids to authenticated, service_role;

select ok(
  public.is_legal_relationship_transition('invited', 'active'),
  'invited relationship can become active'
);
select ok(
  not public.is_legal_relationship_transition('terminated', 'active'),
  'terminated relationship cannot reactivate'
);
select ok(
  public.is_legal_assessment_transition('in_progress', 'submitted'),
  'in-progress assessment can submit'
);
select ok(
  not public.is_legal_assessment_transition('approved', 'under_review'),
  'approved assessment cannot return to review'
);
select ok(
  public.is_legal_finding_transition('response_required', 'response_submitted'),
  'finding accepts a supplier response'
);
select ok(
  not public.is_legal_finding_transition('closed', 'open'),
  'closed finding cannot reopen'
);
select ok(
  public.is_legal_document_version_transition('pending_upload', 'uploaded'),
  'pending upload can finalize'
);
select ok(
  not public.is_legal_document_version_transition('ready', 'processing'),
  'ready document cannot return to processing'
);
select ok(
  public.is_legal_corrective_action_transition('draft', 'submitted'),
  'draft corrective action can submit'
);
select ok(
  not public.is_legal_corrective_action_transition('completed', 'accepted'),
  'completed corrective action is terminal'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into public.program_versions (
  id, qualification_program_id, version_number, status, change_summary
) values (
  '51000000-0000-4000-8000-000000000002',
  '50000000-0000-4000-8000-000000000001',
  2,
  'draft',
  'Add a compact Greenline workflow fixture.'
);
insert into public.questionnaire_sections (
  id, program_version_id, title, description, display_order
) values (
  '52000000-0000-4000-8000-000000000099',
  '51000000-0000-4000-8000-000000000002',
  'Demonstration controls',
  'Synthetic end-to-end workflow controls.',
  10
);
insert into public.questions (
  id, program_version_id, section_id, stable_question_key, prompt,
  answer_type, required, display_order, conditional_visibility_rules
) values
  (
    '53000000-0000-4000-8000-000000000098',
    '51000000-0000-4000-8000-000000000002',
    '52000000-0000-4000-8000-000000000099',
    'requires_control_detail',
    'Does the fictional control require a detailed summary?',
    'boolean',
    true,
    5,
    '{}'::jsonb
  ),
  (
    '53000000-0000-4000-8000-000000000099',
    '51000000-0000-4000-8000-000000000002',
    '52000000-0000-4000-8000-000000000099',
    'demo_control_summary',
    'Describe the fictional control review.',
    'long_text',
    true,
    10,
    '{"question_key":"requires_control_detail","operator":"equals","value":true}'::jsonb
  );
insert into public.document_requirements (
  id, program_version_id, stable_requirement_key, name, description,
  required, accepted_mime_types, maximum_size_bytes, display_order
) values (
  '55000000-0000-4000-8000-000000000099',
  '51000000-0000-4000-8000-000000000002',
  'demo_control_evidence',
  'Fictional control evidence',
  'Text-only portfolio fixture.',
  true,
  array['text/plain'],
  4096,
  10
);

select is(
  (
    select status
    from public.publish_program_version(
      '51000000-0000-4000-8000-000000000002',
      current_date
    )
  ),
  'active',
  'buyer administrator publishes a complete draft version'
);
select is(
  (select status from public.program_versions where id = '51000000-0000-4000-8000-000000000001'),
  'retired',
  'publishing retires the prior active version'
);
select is(
  (select current_version_id from public.qualification_programs where id = '50000000-0000-4000-8000-000000000001'),
  '51000000-0000-4000-8000-000000000002'::uuid,
  'program points to the newly published version'
);
select is(
  (select program_version_id from public.assessments where id = '60000000-0000-4000-8000-000000000001'),
  '51000000-0000-4000-8000-000000000001'::uuid,
  'historical Nova assessment remains pinned to version one'
);
select results_eq(
  $$
    update public.questions
    set prompt = 'Attempted post-publication rewrite'
    where id = '53000000-0000-4000-8000-000000000099'
    returning id::text
  $$,
  array[]::text[],
  'newly published question becomes immutable'
);

insert into workflow_test_ids (key, id)
select
  'assessment',
  assessment.id
from public.create_assessment(
  '40000000-0000-4000-8000-000000000002',
  '50000000-0000-4000-8000-000000000001',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc0',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
) assessment;

select is(
  (
    select program_version_id
    from public.assessments
    where id = (select id from workflow_test_ids where key = 'assessment')
  ),
  '51000000-0000-4000-8000-000000000002'::uuid,
  'new assessment uses the current active program version'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc0', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.email', 'owner@greenline-packaging.invalid', true);

insert into public.assessment_responses (
  assessment_id, question_id, response_text, response_boolean, answered_by
) values
  (
    (select id from workflow_test_ids where key = 'assessment'),
    '53000000-0000-4000-8000-000000000098',
    null,
    true,
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc0'
  ),
  (
    (select id from workflow_test_ids where key = 'assessment'),
    '53000000-0000-4000-8000-000000000099',
    'Greenline completed this fictional control review for a portfolio-safe workflow.',
    null,
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc0'
  );

select ok(
  public.is_question_visible(
    (select id from workflow_test_ids where key = 'assessment'),
    '53000000-0000-4000-8000-000000000099'
  ),
  'conditional required question becomes visible from its controlling answer'
);

insert into workflow_test_ids (key, id)
select
  'document_version',
  version.id
from public.create_document_version(
  (select id from workflow_test_ids where key = 'assessment'),
  '55000000-0000-4000-8000-000000000099',
  'greenline-control-evidence.txt',
  'text/plain',
  512,
  'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  null,
  null,
  'Greenline Demonstration'
) version;

select is(
  (
    select upload_status
    from public.document_versions
    where id = (select id from workflow_test_ids where key = 'document_version')
  ),
  'pending_upload',
  'supplier creates pending immutable document metadata'
);
select throws_like(
  format(
    'select public.submit_assessment(%L, %L)',
    (select id from workflow_test_ids where key = 'assessment'),
    'I confirm that this fictional submission is complete and portfolio safe.'
  ),
  '%assessment is incomplete%',
  'assessment submission is blocked until document processing succeeds'
);
reset role;

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select is(
  (
    select upload_status
    from public.finalize_document_upload(
      (select id from workflow_test_ids where key = 'document_version'),
      'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      512
    )
  ),
  'uploaded',
  'service worker finalizes the exact pending upload'
);
select is(
  (
    select upload_status
    from public.complete_document_processing(
      (select id from workflow_test_ids where key = 'document_version'),
      true,
      null
    )
  ),
  'ready',
  'service worker completes the processing state machine'
);
select is(
  (
    select current_version_id
    from public.documents
    where id = (
      select document_id
      from public.document_versions
      where id = (select id from workflow_test_ids where key = 'document_version')
    )
  ),
  (select id from workflow_test_ids where key = 'document_version'),
  'finalized document version becomes the current version'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc0', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  (
    select status
    from public.submit_assessment(
      (select id from workflow_test_ids where key = 'assessment'),
      'I confirm that this fictional submission is complete and portfolio safe.'
    )
  ),
  'submitted',
  'supplier submits a complete assessment transactionally'
);
select is(
  (
    select count(*)
    from public.assessment_submission_snapshots
    where assessment_id = (select id from workflow_test_ids where key = 'assessment')
  ),
  1::bigint,
  'submission creates one immutable response and document snapshot'
);
select throws_ok(
  format(
    'select public.submit_assessment(%L, %L)',
    (select id from workflow_test_ids where key = 'assessment'),
    'Duplicate fictional submission must be rejected safely.'
  ),
  '42501',
  'assessment submission is not authorized',
  'duplicate submission cannot create a second terminal action'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  (
    select status
    from public.start_assessment_review(
      (select id from workflow_test_ids where key = 'assessment')
    )
  ),
  'under_review',
  'assigned buyer reviewer starts review'
);
select is(
  (
    select status
    from public.record_document_review(
      (select id from workflow_test_ids where key = 'assessment'),
      (select id from workflow_test_ids where key = 'document_version'),
      'accepted',
      'Synthetic evidence is sufficient.',
      'Buyer-only synthetic review note.'
    )
  ),
  'accepted',
  'buyer reviewer accepts the processed document'
);

insert into workflow_test_ids (key, id)
select
  'finding',
  finding.id
from public.create_assessment_finding(
  (select id from workflow_test_ids where key = 'assessment'),
  'medium',
  'control-documentation',
  'Document the review cadence',
  'Add a concise fictional review cadence to the control description.',
  'Buyer-only synthetic context.',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc0',
  now() + interval '14 days'
) finding;

select is(
  (select status from public.findings_visible where id = (select id from workflow_test_ids where key = 'finding')),
  'response_required',
  'buyer finding begins in response-required state'
);
select is(
  (select finding_number from public.findings_visible where id = (select id from workflow_test_ids where key = 'finding')),
  1,
  'finding number is allocated sequentially under lock'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc0', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
insert into workflow_test_ids (key, id)
select
  'corrective_action',
  action.id
from public.submit_corrective_action(
  (select id from workflow_test_ids where key = 'finding'),
  'The fictional cadence was not explicitly recorded.',
  'A review cadence was added to the demonstration procedure.',
  'A recurring fictional review task was added.',
  current_date + 30
) action;

select is(
  (select status from public.corrective_actions where id = (select id from workflow_test_ids where key = 'corrective_action')),
  'submitted',
  'supplier corrective action is submitted'
);
select is(
  (select status from public.findings_visible where id = (select id from workflow_test_ids where key = 'finding')),
  'response_submitted',
  'finding advances when supplier response arrives'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  (
    select status
    from public.verify_corrective_action(
      (select id from workflow_test_ids where key = 'corrective_action'),
      'accepted',
      'The fictional remediation is sufficient.'
    )
  ),
  'accepted',
  'buyer reviewer accepts corrective action'
);
select is(
  (select status from public.findings_visible where id = (select id from workflow_test_ids where key = 'finding')),
  'verified',
  'accepted corrective action verifies the finding'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
insert into workflow_test_ids (key, id)
select
  'decision',
  decision.id
from public.record_approval_decision(
  (select id from workflow_test_ids where key = 'assessment'),
  'conditionally_approved',
  current_date,
  current_date + 365,
  'Maintain the fictional control-review cadence.',
  'Buyer-only rationale for this synthetic conditional approval.'
) decision;

select is(
  (select decision from public.approval_decisions_visible where id = (select id from workflow_test_ids where key = 'decision')),
  'conditionally_approved',
  'buyer owner records conditional approval'
);
select is(
  (
    select status from public.assessments
    where id = (select id from workflow_test_ids where key = 'assessment')
  ),
  'conditionally_approved',
  'decision updates assessment terminal status'
);
select throws_ok(
  format(
    'select public.record_approval_decision(%L, %L, current_date, current_date + 365, %L, %L)',
    (select id from workflow_test_ids where key = 'assessment'),
    'approved',
    'Duplicate decision.',
    'Duplicate internal rationale.'
  ),
  '22023',
  'assessment must be under review before a decision',
  'duplicate approval decision is rejected'
);
reset role;

select ok(
  (
    select count(*) >= 8
    from public.audit_events audit
    where audit.resource_id in (
      (select id from workflow_test_ids where key = 'assessment'),
      (select id from workflow_test_ids where key = 'finding'),
      (select id from workflow_test_ids where key = 'corrective_action'),
      (select id from workflow_test_ids where key = 'decision')
    )
  ),
  'workflow operations append reviewer-ready audit evidence'
);
select ok(
  exists (
    select 1
    from public.notifications
    where related_resource_id = (select id from workflow_test_ids where key = 'decision')
      and notification_type = 'assessment.decision_recorded'
  ),
  'decision creates a supplier notification'
);
select ok(
  exists (
    select 1
    from pgmq.q_report_generation
    where message->>'assessment_id' = (
      select id::text from workflow_test_ids where key = 'assessment'
    )
  ),
  'decision enqueues durable report generation'
);

select * from finish();
rollback;

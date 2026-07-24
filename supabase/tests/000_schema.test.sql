begin;

create extension if not exists pgtap with schema extensions;
select plan(55);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'organizations', 'organizations table exists');
select has_table('public', 'organization_members', 'organization_members table exists');
select has_table('public', 'supplier_profiles', 'supplier_profiles table exists');
select has_table('public', 'supplier_relationships', 'supplier relationships table exists');
select has_table('public', 'supplier_invitations', 'supplier invitations table exists');
select has_table('public', 'qualification_programs', 'qualification programs table exists');
select has_table('public', 'program_versions', 'program versions table exists');
select has_table('public', 'questionnaire_sections', 'questionnaire sections table exists');
select has_table('public', 'questions', 'questions table exists');
select has_table('public', 'question_options', 'question options table exists');
select has_table('public', 'document_requirements', 'document requirements table exists');
select has_table('public', 'assessments', 'assessments table exists');
select has_table('public', 'assessment_responses', 'assessment responses table exists');
select has_table(
  'public',
  'assessment_submission_snapshots',
  'submission snapshots table exists'
);
select has_table('public', 'documents', 'documents table exists');
select has_table('public', 'document_versions', 'document versions table exists');
select has_table('public', 'document_reviews', 'document reviews table exists');
select has_table('public', 'review_tasks', 'review tasks table exists');
select has_table('public', 'findings', 'findings table exists');
select has_table('public', 'finding_events', 'finding events table exists');
select has_table('public', 'corrective_actions', 'corrective actions table exists');
select has_table('public', 'risk_evaluations', 'risk evaluations table exists');
select has_table('public', 'approval_decisions', 'approval decisions table exists');
select has_table('public', 'notifications', 'notifications table exists');
select has_table('public', 'audit_events', 'audit events table exists');

select is(
  (
    select count(*)::integer
    from pg_class
    where relnamespace = 'public'::regnamespace
      and relname in (
        'profiles', 'organizations', 'organization_members', 'supplier_profiles',
        'supplier_relationships', 'supplier_invitations', 'qualification_programs',
        'program_versions', 'questionnaire_sections', 'questions', 'question_options',
        'document_requirements', 'assessments', 'assessment_responses',
        'assessment_submission_snapshots', 'documents', 'document_versions',
        'document_reviews', 'review_tasks', 'findings', 'finding_events',
        'corrective_actions', 'risk_evaluations', 'approval_decisions',
        'notifications', 'audit_events'
      )
      and relrowsecurity
  ),
  26,
  'RLS is enabled on every application table'
);
select is(
  (
    select count(*)::integer
    from pg_class
    where relnamespace = 'public'::regnamespace
      and relname in (
        'profiles', 'organizations', 'organization_members', 'supplier_profiles',
        'supplier_relationships', 'supplier_invitations', 'qualification_programs',
        'program_versions', 'questionnaire_sections', 'questions', 'question_options',
        'document_requirements', 'assessments', 'assessment_responses',
        'assessment_submission_snapshots', 'documents', 'document_versions',
        'document_reviews', 'review_tasks', 'findings', 'finding_events',
        'corrective_actions', 'risk_evaluations', 'approval_decisions',
        'notifications', 'audit_events'
      )
      and relforcerowsecurity
  ),
  26,
  'RLS is forced on every application table'
);

select col_is_pk('public', 'profiles', 'id', 'profile ID is a primary key');
select col_is_pk('public', 'organizations', 'id', 'organization ID is a primary key');
select col_is_pk(
  'public',
  'supplier_relationships',
  'id',
  'relationship ID is a primary key'
);
select col_is_pk('public', 'assessments', 'id', 'assessment ID is a primary key');

select has_index(
  'public',
  'supplier_relationships',
  'supplier_relationship_pair_unique',
  'buyer and supplier relationship is unique'
);
select has_index(
  'public',
  'supplier_invitations',
  'one_pending_invitation_per_buyer_email',
  'pending invitations are idempotent by buyer and email'
);
select has_index(
  'public',
  'program_versions',
  'one_active_version_per_program',
  'one program version can be active'
);
select has_index(
  'public',
  'assessments',
  'assessment_version_assignment_unique',
  'assessment assignment is unique for a version'
);
select has_index(
  'public',
  'document_versions',
  'document_versions_document_id_version_number_key',
  'document version numbers are unique'
);
select has_index(
  'public',
  'findings',
  'findings_assessment_id_finding_number_key',
  'finding numbers are unique within an assessment'
);
select has_index(
  'public',
  'risk_evaluations',
  'one_current_risk_evaluation_per_assessment',
  'one risk evaluation remains current'
);

select has_function('public', 'is_org_member', array['uuid'], 'membership helper exists');
select has_function(
  'public',
  'can_access_relationship',
  array['uuid'],
  'relationship authorization helper exists'
);
select has_function(
  'public',
  'can_review_assessment',
  array['uuid'],
  'reviewer authorization helper exists'
);
select has_function(
  'public',
  'publish_program_version',
  array['uuid', 'date'],
  'program publishing transaction exists'
);
select has_function(
  'public',
  'submit_assessment',
  array['uuid', 'text'],
  'assessment submission transaction exists'
);
select has_function(
  'public',
  'record_approval_decision',
  array['uuid', 'text', 'date', 'date', 'text', 'text'],
  'approval transaction exists'
);
select has_function(
  'public',
  'read_compliance_jobs',
  array['text', 'integer', 'integer'],
  'bounded durable queue reader exists'
);
select has_function(
  'public',
  'is_question_visible',
  array['uuid', 'uuid'],
  'conditional question visibility helper exists'
);

select has_view(
  'public',
  'document_reviews_visible',
  'supplier-safe document review view exists'
);
select has_view('public', 'findings_visible', 'supplier-safe findings view exists');
select has_view(
  'public',
  'approval_decisions_visible',
  'supplier-safe decisions view exists'
);
select has_view(
  'public',
  'risk_evaluations_visible',
  'buyer-only risk evaluation view exists'
);

select has_trigger(
  'public',
  'program_versions',
  'program_versions_immutable_after_publish',
  'published program versions have an immutability trigger'
);
select has_trigger(
  'public',
  'assessments',
  'assessment_version_binding_immutable',
  'assessment version bindings have an immutability trigger'
);
select has_trigger(
  'public',
  'audit_events',
  'audit_events_append_only',
  'audit events have an append-only trigger'
);

select hasnt_column(
  'public',
  'supplier_invitations',
  'invitation_token',
  'plaintext invitation tokens are not stored'
);

select * from finish();
rollback;

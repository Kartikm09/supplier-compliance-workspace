-- Supplier Compliance Workspace
-- Core relational model for a synthetic, multi-tenant buyer/supplier platform.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pgmq;
create extension if not exists pg_cron;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  job_title text check (job_title is null or length(trim(job_title)) between 1 and 120),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  organization_type text not null check (organization_type in ('buyer', 'supplier')),
  legal_name text not null check (length(trim(legal_name)) between 2 and 200),
  display_name text not null check (length(trim(display_name)) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  status text not null default 'active'
    check (status in ('active', 'suspended', 'closed')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (
    role in (
      'buyer_owner', 'buyer_admin', 'buyer_reviewer', 'buyer_viewer',
      'supplier_owner', 'supplier_admin', 'supplier_contributor', 'supplier_viewer'
    )
  ),
  membership_status text not null default 'active'
    check (membership_status in ('invited', 'active', 'suspended', 'removed')),
  invited_by uuid references auth.users(id),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id),
  unique (organization_id, id)
);

create table public.supplier_profiles (
  id uuid primary key default gen_random_uuid(),
  supplier_organization_id uuid not null unique
    references public.organizations(id) on delete cascade,
  registration_number text,
  tax_identifier text,
  website text,
  headquarters_country text check (
    headquarters_country is null or headquarters_country ~ '^[A-Z]{2}$'
  ),
  employee_range text check (
    employee_range is null
    or employee_range in ('1-10', '11-50', '51-250', '251-1000', '1001+')
  ),
  primary_categories jsonb not null default '[]'::jsonb
    check (jsonb_typeof(primary_categories) = 'array'),
  profile_status text not null default 'draft'
    check (profile_status in ('draft', 'complete', 'verified', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.supplier_relationships (
  id uuid primary key default gen_random_uuid(),
  buyer_organization_id uuid not null references public.organizations(id) on delete restrict,
  supplier_organization_id uuid not null references public.organizations(id) on delete restrict,
  buyer_supplier_code text not null check (
    length(trim(buyer_supplier_code)) between 1 and 80
  ),
  relationship_status text not null default 'invited'
    check (relationship_status in ('invited', 'active', 'suspended', 'terminated')),
  onboarding_status text not null default 'invited'
    check (
      onboarding_status in (
        'invited', 'profile_pending', 'qualification_pending',
        'under_review', 'qualified', 'conditionally_qualified', 'rejected'
      )
    ),
  risk_tier text check (risk_tier is null or risk_tier in ('low', 'medium', 'high', 'critical')),
  buyer_owner_user_id uuid references auth.users(id),
  supplier_owner_user_id uuid references auth.users(id),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_relationship_pair_unique
    unique (buyer_organization_id, supplier_organization_id),
  unique (buyer_organization_id, buyer_supplier_code),
  unique (id, buyer_organization_id, supplier_organization_id),
  check (buyer_organization_id <> supplier_organization_id),
  check (
    (relationship_status = 'active' and accepted_at is not null)
    or relationship_status <> 'active'
  )
);

create table public.supplier_invitations (
  id uuid primary key default gen_random_uuid(),
  buyer_organization_id uuid not null references public.organizations(id) on delete cascade,
  intended_supplier_name text not null
    check (length(trim(intended_supplier_name)) between 2 and 200),
  invited_email text not null check (
    invited_email = lower(invited_email)
    and invited_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  invitation_token_hash text not null unique check (
    invitation_token_hash ~ '^[a-f0-9]{64}$'
  ),
  token_prefix text not null unique check (
    token_prefix ~ '^[A-Za-z0-9]{6,16}$'
  ),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null,
  accepted_by_user_id uuid references auth.users(id),
  resulting_supplier_organization_id uuid references public.organizations(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (expires_at > created_at),
  check (
    (status = 'accepted' and accepted_at is not null and accepted_by_user_id is not null)
    or status <> 'accepted'
  )
);

create unique index one_pending_invitation_per_buyer_email
  on public.supplier_invitations(buyer_organization_id, invited_email)
  where status = 'pending';

create table public.qualification_programs (
  id uuid primary key default gen_random_uuid(),
  buyer_organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 200),
  description text not null default '',
  category text not null check (length(trim(category)) between 1 and 100),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'retired')),
  current_version_id uuid,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (buyer_organization_id, name),
  unique (buyer_organization_id, id)
);

create table public.program_versions (
  id uuid primary key default gen_random_uuid(),
  qualification_program_id uuid not null
    references public.qualification_programs(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'retired')),
  effective_from date,
  change_summary text not null default '',
  published_by uuid references auth.users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (qualification_program_id, version_number),
  unique (qualification_program_id, id),
  check (
    (status = 'draft' and published_at is null and published_by is null)
    or (status in ('active', 'retired') and published_at is not null and published_by is not null)
  )
);

alter table public.qualification_programs
  add constraint qualification_program_current_version_fkey
  foreign key (id, current_version_id)
  references public.program_versions(qualification_program_id, id)
  deferrable initially deferred;

create unique index one_active_version_per_program
  on public.program_versions(qualification_program_id)
  where status = 'active';

create table public.questionnaire_sections (
  id uuid primary key default gen_random_uuid(),
  program_version_id uuid not null references public.program_versions(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 160),
  description text not null default '',
  display_order integer not null check (display_order >= 0),
  unique (program_version_id, display_order),
  unique (program_version_id, id)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  program_version_id uuid not null references public.program_versions(id) on delete cascade,
  section_id uuid not null,
  stable_question_key text not null check (
    stable_question_key ~ '^[a-z][a-z0-9_]{2,79}$'
  ),
  prompt text not null check (length(trim(prompt)) between 2 and 1000),
  help_text text not null default '',
  answer_type text not null check (
    answer_type in ('text', 'long_text', 'number', 'boolean', 'date', 'single_select', 'multi_select')
  ),
  required boolean not null default false,
  display_order integer not null check (display_order >= 0),
  validation_rules jsonb not null default '{}'::jsonb
    check (jsonb_typeof(validation_rules) = 'object'),
  conditional_visibility_rules jsonb not null default '{}'::jsonb
    check (jsonb_typeof(conditional_visibility_rules) = 'object'),
  risk_weight numeric(8, 3) not null default 0 check (risk_weight >= 0),
  unique (program_version_id, stable_question_key),
  unique (section_id, display_order),
  unique (program_version_id, id),
  constraint question_section_version_fkey
    foreign key (program_version_id, section_id)
    references public.questionnaire_sections(program_version_id, id)
    on delete cascade
);

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  value text not null check (length(trim(value)) between 1 and 100),
  label text not null check (length(trim(label)) between 1 and 160),
  display_order integer not null check (display_order >= 0),
  risk_score numeric(8, 3) not null default 0 check (risk_score >= 0),
  unique (question_id, value),
  unique (question_id, display_order)
);

create table public.document_requirements (
  id uuid primary key default gen_random_uuid(),
  program_version_id uuid not null references public.program_versions(id) on delete cascade,
  stable_requirement_key text not null check (
    stable_requirement_key ~ '^[a-z][a-z0-9_]{2,79}$'
  ),
  name text not null check (length(trim(name)) between 2 and 160),
  description text not null default '',
  required boolean not null default false,
  accepted_mime_types text[] not null check (cardinality(accepted_mime_types) > 0),
  maximum_size_bytes bigint not null default 10485760
    check (maximum_size_bytes between 1 and 10485760),
  requires_issue_date boolean not null default false,
  requires_expiry_date boolean not null default false,
  minimum_validity_days integer not null default 0
    check (minimum_validity_days between 0 and 3650),
  display_order integer not null check (display_order >= 0),
  unique (program_version_id, stable_requirement_key),
  unique (program_version_id, display_order),
  unique (program_version_id, id),
  check (
    accepted_mime_types <@ array[
      'application/pdf', 'text/plain', 'image/png', 'image/jpeg'
    ]::text[]
  )
);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  supplier_relationship_id uuid not null
    references public.supplier_relationships(id) on delete restrict,
  qualification_program_id uuid not null
    references public.qualification_programs(id) on delete restrict,
  program_version_id uuid not null,
  status text not null default 'draft'
    check (
      status in (
        'draft', 'in_progress', 'submitted', 'under_review',
        'changes_requested', 'resubmitted', 'approved',
        'conditionally_approved', 'rejected', 'withdrawn'
      )
    ),
  assigned_supplier_user_id uuid references auth.users(id),
  assigned_buyer_reviewer_id uuid references auth.users(id),
  started_at timestamptz,
  submitted_at timestamptz,
  review_started_at timestamptz,
  decided_at timestamptz,
  completeness_percentage numeric(5, 2) not null default 0
    check (completeness_percentage between 0 and 100),
  supplier_declaration text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_version_assignment_unique
    unique (supplier_relationship_id, qualification_program_id, program_version_id),
  constraint assessment_program_version_fkey
    foreign key (qualification_program_id, program_version_id)
    references public.program_versions(qualification_program_id, id)
    on delete restrict,
  check (submitted_at is null or started_at is null or submitted_at >= started_at),
  check (decided_at is null or submitted_at is null or decided_at >= submitted_at)
);

create table public.assessment_responses (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  response_text text,
  response_number numeric,
  response_boolean boolean,
  response_date date,
  response_option_id uuid references public.question_options(id),
  response_json jsonb,
  answered_by uuid not null references auth.users(id),
  answered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, question_id),
  check (response_json is null or jsonb_typeof(response_json) in ('array', 'object'))
);

create table public.assessment_submission_snapshots (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete restrict,
  submission_number integer not null check (submission_number > 0),
  submitted_by uuid not null references auth.users(id),
  responses_snapshot jsonb not null check (jsonb_typeof(responses_snapshot) = 'array'),
  documents_snapshot jsonb not null check (jsonb_typeof(documents_snapshot) = 'array'),
  declaration text not null,
  completeness_percentage numeric(5, 2) not null
    check (completeness_percentage between 0 and 100),
  submitted_at timestamptz not null default now(),
  unique (assessment_id, submission_number)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  supplier_relationship_id uuid not null
    references public.supplier_relationships(id) on delete restrict,
  supplier_organization_id uuid not null references public.organizations(id) on delete restrict,
  document_requirement_id uuid references public.document_requirements(id) on delete restrict,
  document_type text not null check (length(trim(document_type)) between 1 and 100),
  current_version_id uuid,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'accepted', 'replacement_requested', 'archived')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_relationship_id, document_requirement_id),
  unique (id, supplier_relationship_id)
);

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  storage_path text not null unique check (
    storage_path !~ '(^|/)\.\.(/|$)'
    and storage_path !~ '^/'
  ),
  original_filename text not null check (length(trim(original_filename)) between 1 and 255),
  sanitized_filename text not null check (
    sanitized_filename ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$'
  ),
  mime_type text not null check (
    mime_type in ('application/pdf', 'text/plain', 'image/png', 'image/jpeg')
  ),
  byte_size bigint not null check (byte_size between 1 and 10485760),
  sha256_hash text not null check (sha256_hash ~ '^[a-f0-9]{64}$'),
  issue_date date,
  expiry_date date,
  issuing_body text,
  upload_status text not null default 'pending_upload'
    check (
      upload_status in (
        'pending_upload', 'uploaded', 'processing', 'ready', 'rejected', 'superseded'
      )
    ),
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processing', 'complete', 'failed')),
  processing_error text,
  uploaded_by uuid not null references auth.users(id),
  uploaded_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (document_id, version_number),
  unique (document_id, id),
  check (expiry_date is null or issue_date is null or expiry_date >= issue_date),
  check (
    (upload_status = 'pending_upload' and uploaded_at is null)
    or (upload_status = 'rejected')
    or (upload_status not in ('pending_upload', 'rejected') and uploaded_at is not null)
  )
);

alter table public.documents
  add constraint document_current_version_fkey
  foreign key (id, current_version_id)
  references public.document_versions(document_id, id)
  deferrable initially deferred;

create table public.document_reviews (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  document_version_id uuid not null references public.document_versions(id) on delete restrict,
  reviewer_user_id uuid not null references auth.users(id),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'replacement_requested')),
  reviewer_note text,
  internal_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (assessment_id, document_version_id)
);

create table public.review_tasks (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  buyer_organization_id uuid not null references public.organizations(id) on delete cascade,
  assigned_to uuid not null references auth.users(id),
  task_type text not null check (
    task_type in ('initial_review', 'document_review', 'finding_verification', 'decision_review')
  ),
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index one_open_review_task_per_type
  on public.review_tasks(assessment_id, assigned_to, task_type)
  where status in ('pending', 'in_progress');

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  buyer_organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_relationship_id uuid not null
    references public.supplier_relationships(id) on delete restrict,
  finding_number integer not null check (finding_number > 0),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  category text not null check (length(trim(category)) between 1 and 100),
  title text not null check (length(trim(title)) between 2 and 200),
  description text not null check (length(trim(description)) between 2 and 4000),
  status text not null default 'open'
    check (
      status in (
        'open', 'response_required', 'response_submitted',
        'verification_required', 'verified', 'rejected', 'closed'
      )
    ),
  internal_note text,
  raised_by uuid not null references auth.users(id),
  assigned_supplier_user_id uuid references auth.users(id),
  due_at timestamptz,
  raised_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (assessment_id, finding_number)
);

create table public.finding_events (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.findings(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  event_type text not null check (length(trim(event_type)) between 1 and 100),
  supplier_visible boolean not null default true,
  comment text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table public.corrective_actions (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.findings(id) on delete cascade,
  supplier_organization_id uuid not null references public.organizations(id) on delete restrict,
  submitted_by uuid not null references auth.users(id),
  root_cause text not null check (length(trim(root_cause)) between 2 and 4000),
  correction text not null check (length(trim(correction)) between 2 and 4000),
  preventive_action text not null check (
    length(trim(preventive_action)) between 2 and 4000
  ),
  target_completion_date date not null,
  status text not null default 'submitted'
    check (status in ('draft', 'submitted', 'accepted', 'revision_required', 'completed')),
  submitted_at timestamptz,
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  verification_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'draft' and submitted_at is null)
    or (status <> 'draft' and submitted_at is not null)
  ),
  check (
    (status in ('accepted', 'completed') and verified_at is not null and verified_by is not null)
    or status not in ('accepted', 'completed')
  )
);

create unique index one_active_corrective_action_per_finding
  on public.corrective_actions(finding_id)
  where status in ('draft', 'submitted', 'accepted');

create table public.risk_evaluations (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  calculation_version integer not null check (calculation_version > 0),
  total_score numeric(10, 3) not null check (total_score >= 0),
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  scoring_breakdown jsonb not null check (jsonb_typeof(scoring_breakdown) = 'object'),
  calculated_at timestamptz not null default now(),
  calculated_by_type text not null
    check (calculated_by_type in ('system', 'reviewer', 'import')),
  superseded_at timestamptz,
  unique (assessment_id, calculation_version)
);

create unique index one_current_risk_evaluation_per_assessment
  on public.risk_evaluations(assessment_id)
  where superseded_at is null;

create table public.approval_decisions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete restrict,
  buyer_organization_id uuid not null references public.organizations(id) on delete restrict,
  decision text not null
    check (decision in ('approved', 'conditionally_approved', 'rejected', 'deferred')),
  effective_from date,
  valid_until date,
  conditions text,
  internal_rationale text not null check (length(trim(internal_rationale)) between 2 and 4000),
  decided_by uuid not null references auth.users(id),
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (valid_until is null or effective_from is null or valid_until >= effective_from)
);

create unique index one_terminal_decision_per_assessment
  on public.approval_decisions(assessment_id)
  where decision in ('approved', 'conditionally_approved', 'rejected');

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  related_resource_type text not null check (
    related_resource_type in (
      'invitation', 'relationship', 'assessment', 'document',
      'finding', 'corrective_action', 'decision'
    )
  ),
  related_resource_id uuid,
  notification_type text not null check (length(trim(notification_type)) between 1 and 100),
  title text not null check (length(trim(title)) between 2 and 200),
  body text not null check (length(trim(body)) between 2 and 1000),
  status text not null default 'unread' check (status in ('unread', 'read', 'archived')),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (status = 'read' and read_at is not null)
    or status <> 'read'
  )
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  relationship_id uuid references public.supplier_relationships(id) on delete set null,
  actor_user_id uuid references auth.users(id),
  actor_organization_id uuid references public.organizations(id),
  action text not null check (length(trim(action)) between 2 and 120),
  resource_type text not null check (length(trim(resource_type)) between 2 and 100),
  resource_id uuid,
  old_values jsonb not null default '{}'::jsonb check (jsonb_typeof(old_values) = 'object'),
  new_values jsonb not null default '{}'::jsonb check (jsonb_typeof(new_values) = 'object'),
  correlation_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- Indexes follow the primary access paths used by RLS, portals, reminders, and reviews.
create index organization_members_user_active_idx
  on public.organization_members(user_id, organization_id)
  where membership_status = 'active';
create index supplier_relationships_buyer_status_idx
  on public.supplier_relationships(buyer_organization_id, relationship_status);
create index supplier_relationships_supplier_status_idx
  on public.supplier_relationships(supplier_organization_id, relationship_status);
create index supplier_invitations_expiry_idx
  on public.supplier_invitations(status, expires_at);
create index qualification_programs_buyer_status_idx
  on public.qualification_programs(buyer_organization_id, status);
create index program_versions_program_status_idx
  on public.program_versions(qualification_program_id, status);
create index assessments_relationship_status_idx
  on public.assessments(supplier_relationship_id, status, updated_at desc);
create index assessments_reviewer_status_idx
  on public.assessments(assigned_buyer_reviewer_id, status)
  where assigned_buyer_reviewer_id is not null;
create index assessments_supplier_assignee_idx
  on public.assessments(assigned_supplier_user_id, status)
  where assigned_supplier_user_id is not null;
create index document_versions_expiry_idx
  on public.document_versions(expiry_date)
  where upload_status = 'ready' and expiry_date is not null;
create index document_reviews_assessment_status_idx
  on public.document_reviews(assessment_id, status);
create index review_tasks_assignee_status_idx
  on public.review_tasks(assigned_to, status, due_at);
create index findings_relationship_status_idx
  on public.findings(supplier_relationship_id, status, severity);
create index findings_due_idx
  on public.findings(due_at)
  where status not in ('verified', 'closed');
create index corrective_actions_due_idx
  on public.corrective_actions(target_completion_date)
  where status not in ('completed', 'accepted');
create index notifications_recipient_status_idx
  on public.notifications(organization_id, user_id, status, created_at desc);
create index audit_events_timeline_idx
  on public.audit_events(organization_id, created_at desc);
create index audit_events_relationship_idx
  on public.audit_events(relationship_id, created_at desc)
  where relationship_id is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'profiles', 'organizations', 'supplier_profiles', 'supplier_relationships',
    'qualification_programs', 'assessments', 'assessment_responses', 'documents',
    'corrective_actions'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I '
      'for each row execute function public.set_updated_at()',
      target_table || '_set_updated_at',
      target_table
    );
  end loop;
end;
$$;

create or replace function public.validate_organization_role()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  target_type text;
begin
  select organization_type
  into target_type
  from public.organizations
  where id = new.organization_id;

  if target_type = 'buyer' and new.role not like 'buyer\_%' escape '\' then
    raise exception 'buyer organization requires a buyer role' using errcode = '23514';
  end if;
  if target_type = 'supplier' and new.role not like 'supplier\_%' escape '\' then
    raise exception 'supplier organization requires a supplier role' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger organization_member_role_matches_type
before insert or update of organization_id, role on public.organization_members
for each row execute function public.validate_organization_role();

create or replace function public.validate_supplier_profile_organization()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1
    from public.organizations
    where id = new.supplier_organization_id
      and organization_type = 'supplier'
  ) then
    raise exception 'supplier profile requires a supplier organization' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger supplier_profile_organization_type
before insert or update of supplier_organization_id on public.supplier_profiles
for each row execute function public.validate_supplier_profile_organization();

create or replace function public.validate_supplier_relationship()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1 from public.organizations
    where id = new.buyer_organization_id
      and organization_type = 'buyer'
  ) then
    raise exception 'relationship buyer must be a buyer organization' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.organizations
    where id = new.supplier_organization_id
      and organization_type = 'supplier'
  ) then
    raise exception 'relationship supplier must be a supplier organization' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger supplier_relationship_organization_types
before insert or update of buyer_organization_id, supplier_organization_id
on public.supplier_relationships
for each row execute function public.validate_supplier_relationship();

create or replace function public.validate_buyer_owned_record()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  buyer_id uuid;
begin
  buyer_id := case tg_table_name
    when 'supplier_invitations' then new.buyer_organization_id
    when 'qualification_programs' then new.buyer_organization_id
    when 'review_tasks' then new.buyer_organization_id
    when 'findings' then new.buyer_organization_id
    when 'approval_decisions' then new.buyer_organization_id
    else null
  end;

  if buyer_id is null or not exists (
    select 1 from public.organizations
    where id = buyer_id and organization_type = 'buyer'
  ) then
    raise exception '% requires a buyer organization', tg_table_name using errcode = '23514';
  end if;
  return new;
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'supplier_invitations', 'qualification_programs', 'review_tasks',
    'findings', 'approval_decisions'
  ]
  loop
    execute format(
      'create trigger %I before insert or update on public.%I '
      'for each row execute function public.validate_buyer_owned_record()',
      target_table || '_buyer_type',
      target_table
    );
  end loop;
end;
$$;

create or replace function public.validate_assessment_links()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1
    from public.supplier_relationships relationship
    join public.qualification_programs program
      on program.id = new.qualification_program_id
     and program.buyer_organization_id = relationship.buyer_organization_id
    join public.program_versions version
      on version.id = new.program_version_id
     and version.qualification_program_id = program.id
    where relationship.id = new.supplier_relationship_id
  ) then
    raise exception 'assessment relationship, program, and version do not align'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger assessment_links_match
before insert or update of supplier_relationship_id, qualification_program_id, program_version_id
on public.assessments
for each row execute function public.validate_assessment_links();

create or replace function public.protect_assessment_version_binding()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.supplier_relationship_id is distinct from old.supplier_relationship_id
    or new.qualification_program_id is distinct from old.qualification_program_id
    or new.program_version_id is distinct from old.program_version_id then
    raise exception 'assessment relationship and program version are immutable'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger assessment_version_binding_immutable
before update on public.assessments
for each row execute function public.protect_assessment_version_binding();

create or replace function public.validate_assessment_response()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  question_record public.questions;
  assessment_version uuid;
  selected_count integer;
begin
  select * into question_record from public.questions where id = new.question_id;
  select program_version_id into assessment_version
  from public.assessments where id = new.assessment_id;

  if question_record.program_version_id is distinct from assessment_version then
    raise exception 'question does not belong to the assessment program version'
      using errcode = '23514';
  end if;

  selected_count :=
    (new.response_text is not null)::integer
    + (new.response_number is not null)::integer
    + (new.response_boolean is not null)::integer
    + (new.response_date is not null)::integer
    + (new.response_option_id is not null)::integer
    + (new.response_json is not null)::integer;

  if selected_count <> 1 then
    raise exception 'exactly one response value is required' using errcode = '23514';
  end if;

  if question_record.answer_type in ('text', 'long_text')
    and new.response_text is null then
    raise exception 'text response required for question type %', question_record.answer_type
      using errcode = '23514';
  elsif question_record.answer_type = 'number' and new.response_number is null then
    raise exception 'numeric response required' using errcode = '23514';
  elsif question_record.answer_type = 'boolean' and new.response_boolean is null then
    raise exception 'boolean response required' using errcode = '23514';
  elsif question_record.answer_type = 'date' and new.response_date is null then
    raise exception 'date response required' using errcode = '23514';
  elsif question_record.answer_type = 'single_select' then
    if new.response_option_id is null or not exists (
      select 1 from public.question_options
      where id = new.response_option_id and question_id = new.question_id
    ) then
      raise exception 'valid option response required' using errcode = '23514';
    end if;
  elsif question_record.answer_type = 'multi_select' then
    if new.response_json is null or jsonb_typeof(new.response_json) <> 'array' then
      raise exception 'array response required for multi-select' using errcode = '23514';
    end if;
    if exists (
      select 1
      from jsonb_array_elements_text(new.response_json) selected(value)
      where not exists (
        select 1 from public.question_options option
        where option.question_id = new.question_id
          and option.value = selected.value
      )
    ) then
      raise exception 'multi-select response contains an invalid option' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger assessment_response_value_matches_question
before insert or update on public.assessment_responses
for each row execute function public.validate_assessment_response();

create or replace function public.prevent_locked_response_change()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  assessment_status text;
  target_assessment uuid;
begin
  target_assessment := case when tg_op = 'DELETE' then old.assessment_id else new.assessment_id end;
  select status into assessment_status
  from public.assessments
  where id = target_assessment;

  if assessment_status not in ('draft', 'in_progress', 'changes_requested') then
    raise exception 'assessment responses are locked in status %', assessment_status
      using errcode = '55000';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger assessment_responses_lock_after_submission
before insert or update or delete on public.assessment_responses
for each row execute function public.prevent_locked_response_change();

create or replace function public.validate_document_links()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  relationship_supplier uuid;
  requirement_version uuid;
begin
  select supplier_organization_id
  into relationship_supplier
  from public.supplier_relationships
  where id = new.supplier_relationship_id;

  if relationship_supplier is distinct from new.supplier_organization_id then
    raise exception 'document supplier does not match relationship supplier'
      using errcode = '23514';
  end if;

  if new.document_requirement_id is not null then
    select program_version_id
    into requirement_version
    from public.document_requirements
    where id = new.document_requirement_id;
    if not exists (
      select 1 from public.assessments
      where supplier_relationship_id = new.supplier_relationship_id
        and program_version_id = requirement_version
    ) then
      raise exception 'document requirement is not assigned to this relationship'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger document_links_match
before insert or update of supplier_relationship_id, supplier_organization_id, document_requirement_id
on public.documents
for each row execute function public.validate_document_links();

create or replace function public.prevent_historical_document_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.upload_status <> 'pending_upload' and (
    new.document_id is distinct from old.document_id
    or new.version_number is distinct from old.version_number
    or new.storage_path is distinct from old.storage_path
    or new.original_filename is distinct from old.original_filename
    or new.sanitized_filename is distinct from old.sanitized_filename
    or new.mime_type is distinct from old.mime_type
    or new.byte_size is distinct from old.byte_size
    or new.sha256_hash is distinct from old.sha256_hash
    or new.issue_date is distinct from old.issue_date
    or new.expiry_date is distinct from old.expiry_date
    or new.issuing_body is distinct from old.issuing_body
    or new.uploaded_by is distinct from old.uploaded_by
    or new.uploaded_at is distinct from old.uploaded_at
  ) then
    raise exception 'uploaded document version metadata is immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger document_version_history_immutable
before update on public.document_versions
for each row execute function public.prevent_historical_document_mutation();

create or replace function public.prevent_append_only_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end;
$$;

create trigger assessment_submission_snapshots_append_only
before update or delete on public.assessment_submission_snapshots
for each row execute function public.prevent_append_only_change();
create trigger risk_evaluations_append_only
before update or delete on public.risk_evaluations
for each row execute function public.prevent_append_only_change();
create trigger approval_decisions_append_only
before update or delete on public.approval_decisions
for each row execute function public.prevent_append_only_change();
create trigger audit_events_append_only
before update or delete on public.audit_events
for each row execute function public.prevent_append_only_change();

create or replace function public.protect_program_definition()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  version_id uuid;
  version_status text;
begin
  if tg_table_name = 'question_options' then
    select question.program_version_id
    into version_id
    from public.questions question
    where question.id = case when tg_op = 'DELETE' then old.question_id else new.question_id end;
  else
    version_id := case when tg_op = 'DELETE' then old.program_version_id else new.program_version_id end;
  end if;

  select status into version_status
  from public.program_versions
  where id = version_id;

  if version_status <> 'draft' then
    raise exception 'published program definitions are immutable' using errcode = '55000';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger questionnaire_sections_draft_only
before insert or update or delete on public.questionnaire_sections
for each row execute function public.protect_program_definition();
create trigger questions_draft_only
before insert or update or delete on public.questions
for each row execute function public.protect_program_definition();
create trigger question_options_draft_only
before insert or update or delete on public.question_options
for each row execute function public.protect_program_definition();
create trigger document_requirements_draft_only
before insert or update or delete on public.document_requirements
for each row execute function public.protect_program_definition();

create or replace function public.protect_published_program_version()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' and old.status <> 'draft' then
    raise exception 'published program versions are immutable' using errcode = '55000';
  end if;
  if tg_op = 'UPDATE' and old.status <> 'draft' then
    if not (
      old.status = 'active'
      and new.status = 'retired'
      and (to_jsonb(new) - 'status') = (to_jsonb(old) - 'status')
    ) then
      raise exception 'published program versions are immutable' using errcode = '55000';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger program_versions_immutable_after_publish
before update or delete on public.program_versions
for each row execute function public.protect_published_program_version();

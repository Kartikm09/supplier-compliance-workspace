-- Relationship-aware authorization, grants, and supplier-safe projections.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Workspace user'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger auth_user_profile_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.organization_members member
    join public.organizations organization on organization.id = member.organization_id
    where member.organization_id = target_organization_id
      and member.user_id = auth.uid()
      and member.membership_status = 'active'
      and organization.status = 'active'
  )
$$;

create or replace function public.org_role(target_organization_id uuid)
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select member.role
  from public.organization_members member
  join public.organizations organization on organization.id = member.organization_id
  where member.organization_id = target_organization_id
    and member.user_id = auth.uid()
    and member.membership_status = 'active'
    and organization.status = 'active'
$$;

create or replace function public.org_type(target_organization_id uuid)
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select organization.organization_type
  from public.organizations organization
  where organization.id = target_organization_id
    and public.is_org_member(organization.id)
$$;

create or replace function public.has_any_org_role(
  target_organization_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(public.org_role(target_organization_id) = any(allowed_roles), false)
$$;

create or replace function public.is_buyer_manager(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.has_any_org_role(
    target_organization_id,
    array['buyer_owner', 'buyer_admin']
  )
$$;

create or replace function public.is_supplier_manager(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.has_any_org_role(
    target_organization_id,
    array['supplier_owner', 'supplier_admin']
  )
$$;

create or replace function public.buyer_can_access_relationship(target_relationship_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.supplier_relationships relationship
    where relationship.id = target_relationship_id
      and public.is_org_member(relationship.buyer_organization_id)
  )
$$;

create or replace function public.supplier_can_access_relationship(target_relationship_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.supplier_relationships relationship
    where relationship.id = target_relationship_id
      and relationship.relationship_status = 'active'
      and public.is_org_member(relationship.supplier_organization_id)
  )
$$;

create or replace function public.can_access_relationship(target_relationship_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.buyer_can_access_relationship(target_relationship_id)
      or public.supplier_can_access_relationship(target_relationship_id)
$$;

create or replace function public.can_view_organization(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.is_org_member(target_organization_id)
    or exists (
      select 1
      from public.supplier_relationships relationship
      where (
        relationship.buyer_organization_id = target_organization_id
        or relationship.supplier_organization_id = target_organization_id
      )
      and public.can_access_relationship(relationship.id)
    )
$$;

create or replace function public.can_view_assessment(target_assessment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.assessments assessment
    where assessment.id = target_assessment_id
      and public.can_access_relationship(assessment.supplier_relationship_id)
  )
$$;

create or replace function public.can_review_assessment(target_assessment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.assessments assessment
    join public.supplier_relationships relationship
      on relationship.id = assessment.supplier_relationship_id
    where assessment.id = target_assessment_id
      and (
        public.is_buyer_manager(relationship.buyer_organization_id)
        or (
          assessment.assigned_buyer_reviewer_id = auth.uid()
          and public.has_any_org_role(
            relationship.buyer_organization_id,
            array['buyer_reviewer', 'buyer_admin', 'buyer_owner']
          )
        )
      )
  )
$$;

create or replace function public.can_edit_assessment(target_assessment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.assessments assessment
    join public.supplier_relationships relationship
      on relationship.id = assessment.supplier_relationship_id
    where assessment.id = target_assessment_id
      and relationship.relationship_status = 'active'
      and assessment.status in ('draft', 'in_progress', 'changes_requested')
      and (
        public.is_supplier_manager(relationship.supplier_organization_id)
        or (
          assessment.assigned_supplier_user_id = auth.uid()
          and public.has_any_org_role(
            relationship.supplier_organization_id,
            array['supplier_contributor', 'supplier_admin', 'supplier_owner']
          )
        )
      )
  )
$$;

create or replace function public.can_view_program_version(target_program_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.program_versions version
    join public.qualification_programs program
      on program.id = version.qualification_program_id
    where version.id = target_program_version_id
      and (
        public.is_org_member(program.buyer_organization_id)
        or exists (
          select 1
          from public.assessments assessment
          where assessment.program_version_id = version.id
            and public.supplier_can_access_relationship(assessment.supplier_relationship_id)
        )
      )
  )
$$;

create or replace function public.can_manage_program_version(target_program_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.program_versions version
    join public.qualification_programs program
      on program.id = version.qualification_program_id
    where version.id = target_program_version_id
      and version.status = 'draft'
      and public.is_buyer_manager(program.buyer_organization_id)
  )
$$;

create or replace function public.can_manage_membership(
  target_organization_id uuid,
  target_user_id uuid,
  target_role text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select target_user_id <> auth.uid()
    and case public.org_role(target_organization_id)
      when 'buyer_owner' then target_role in (
        'buyer_admin', 'buyer_reviewer', 'buyer_viewer'
      )
      when 'buyer_admin' then target_role in ('buyer_reviewer', 'buyer_viewer')
      when 'supplier_owner' then target_role in (
        'supplier_admin', 'supplier_contributor', 'supplier_viewer'
      )
      when 'supplier_admin' then target_role in ('supplier_contributor', 'supplier_viewer')
      else false
    end
$$;

create or replace function public.can_view_document(target_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.documents document
    where document.id = target_document_id
      and public.can_access_relationship(document.supplier_relationship_id)
  )
$$;

create or replace function public.can_view_finding(target_finding_id uuid)
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
      and public.can_access_relationship(finding.supplier_relationship_id)
  )
$$;

create or replace function public.request_email()
returns text
language sql
stable
set search_path = pg_catalog
as $$
  select lower(coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    nullif(
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb)->>'email',
      ''
    )
  ))
$$;

do $$
declare
  function_signature text;
begin
  foreach function_signature in array array[
    'public.is_org_member(uuid)',
    'public.org_role(uuid)',
    'public.org_type(uuid)',
    'public.has_any_org_role(uuid,text[])',
    'public.is_buyer_manager(uuid)',
    'public.is_supplier_manager(uuid)',
    'public.buyer_can_access_relationship(uuid)',
    'public.supplier_can_access_relationship(uuid)',
    'public.can_access_relationship(uuid)',
    'public.can_view_organization(uuid)',
    'public.can_view_assessment(uuid)',
    'public.can_review_assessment(uuid)',
    'public.can_edit_assessment(uuid)',
    'public.can_view_program_version(uuid)',
    'public.can_manage_program_version(uuid)',
    'public.can_manage_membership(uuid,uuid,text)',
    'public.can_view_document(uuid)',
    'public.can_view_finding(uuid)'
  ]
  loop
    execute format('revoke all on function %s from public', function_signature);
    execute format('grant execute on function %s to authenticated', function_signature);
  end loop;
end;
$$;

revoke all on function public.request_email() from public;
grant execute on function public.request_email() to authenticated;

-- Every exposed application table has RLS enabled and forced. Grants are added
-- after policies so a missing policy fails closed.
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'profiles', 'organizations', 'organization_members', 'supplier_profiles',
    'supplier_relationships', 'supplier_invitations', 'qualification_programs',
    'program_versions', 'questionnaire_sections', 'questions', 'question_options',
    'document_requirements', 'assessments', 'assessment_responses',
    'assessment_submission_snapshots', 'documents', 'document_versions',
    'document_reviews', 'review_tasks', 'findings', 'finding_events',
    'corrective_actions', 'risk_evaluations', 'approval_decisions',
    'notifications', 'audit_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', target_table);
    execute format('alter table public.%I force row level security', target_table);
    execute format('revoke all on public.%I from anon, authenticated', target_table);
  end loop;
end;
$$;

create policy profiles_read_related_users
on public.profiles for select to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs
      on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid()
      and mine.membership_status = 'active'
      and theirs.user_id = profiles.id
      and theirs.membership_status = 'active'
  )
);
create policy profiles_update_self
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy organizations_read_visible
on public.organizations for select to authenticated
using (public.can_view_organization(id));

create policy organization_members_read_same_org
on public.organization_members for select to authenticated
using (public.is_org_member(organization_id));
create policy organization_members_insert_managers
on public.organization_members for insert to authenticated
with check (public.can_manage_membership(organization_id, user_id, role));
create policy organization_members_update_managers
on public.organization_members for update to authenticated
using (public.can_manage_membership(organization_id, user_id, role))
with check (public.can_manage_membership(organization_id, user_id, role));

create policy supplier_profiles_read_related
on public.supplier_profiles for select to authenticated
using (
  public.is_org_member(supplier_organization_id)
  or exists (
    select 1
    from public.supplier_relationships relationship
    where relationship.supplier_organization_id = supplier_profiles.supplier_organization_id
      and public.buyer_can_access_relationship(relationship.id)
  )
);
create policy supplier_profiles_manage_supplier
on public.supplier_profiles for all to authenticated
using (public.is_supplier_manager(supplier_organization_id))
with check (public.is_supplier_manager(supplier_organization_id));

create policy supplier_relationships_read_participants
on public.supplier_relationships for select to authenticated
using (public.can_access_relationship(id));

create policy supplier_invitations_read_buyer_managers
on public.supplier_invitations for select to authenticated
using (public.is_buyer_manager(buyer_organization_id));

create policy qualification_programs_read_related
on public.qualification_programs for select to authenticated
using (
  public.is_org_member(buyer_organization_id)
  or exists (
    select 1
    from public.assessments assessment
    where assessment.qualification_program_id = qualification_programs.id
      and public.supplier_can_access_relationship(assessment.supplier_relationship_id)
  )
);
create policy qualification_programs_manage_buyer
on public.qualification_programs for all to authenticated
using (public.is_buyer_manager(buyer_organization_id))
with check (public.is_buyer_manager(buyer_organization_id));

create policy program_versions_read_related
on public.program_versions for select to authenticated
using (public.can_view_program_version(id));
create policy program_versions_manage_drafts
on public.program_versions for insert to authenticated
with check (
  exists (
    select 1
    from public.qualification_programs program
    where program.id = program_versions.qualification_program_id
      and public.is_buyer_manager(program.buyer_organization_id)
  )
);
create policy program_versions_update_drafts
on public.program_versions for update to authenticated
using (public.can_manage_program_version(id))
with check (
  exists (
    select 1
    from public.qualification_programs program
    where program.id = program_versions.qualification_program_id
      and public.is_buyer_manager(program.buyer_organization_id)
  )
);

create policy questionnaire_sections_read_related
on public.questionnaire_sections for select to authenticated
using (public.can_view_program_version(program_version_id));
create policy questionnaire_sections_manage_draft
on public.questionnaire_sections for all to authenticated
using (public.can_manage_program_version(program_version_id))
with check (public.can_manage_program_version(program_version_id));

create policy questions_read_related
on public.questions for select to authenticated
using (public.can_view_program_version(program_version_id));
create policy questions_manage_draft
on public.questions for all to authenticated
using (public.can_manage_program_version(program_version_id))
with check (public.can_manage_program_version(program_version_id));

create policy question_options_read_related
on public.question_options for select to authenticated
using (
  exists (
    select 1 from public.questions question
    where question.id = question_options.question_id
      and public.can_view_program_version(question.program_version_id)
  )
);
create policy question_options_manage_draft
on public.question_options for all to authenticated
using (
  exists (
    select 1 from public.questions question
    where question.id = question_options.question_id
      and public.can_manage_program_version(question.program_version_id)
  )
)
with check (
  exists (
    select 1 from public.questions question
    where question.id = question_options.question_id
      and public.can_manage_program_version(question.program_version_id)
  )
);

create policy document_requirements_read_related
on public.document_requirements for select to authenticated
using (public.can_view_program_version(program_version_id));
create policy document_requirements_manage_draft
on public.document_requirements for all to authenticated
using (public.can_manage_program_version(program_version_id))
with check (public.can_manage_program_version(program_version_id));

create policy assessments_read_participants
on public.assessments for select to authenticated
using (public.can_access_relationship(supplier_relationship_id));

create policy assessment_responses_read_participants
on public.assessment_responses for select to authenticated
using (public.can_view_assessment(assessment_id));
create policy assessment_responses_insert_supplier
on public.assessment_responses for insert to authenticated
with check (
  answered_by = auth.uid()
  and public.can_edit_assessment(assessment_id)
);
create policy assessment_responses_update_supplier
on public.assessment_responses for update to authenticated
using (public.can_edit_assessment(assessment_id))
with check (
  answered_by = auth.uid()
  and public.can_edit_assessment(assessment_id)
);
create policy assessment_responses_delete_supplier
on public.assessment_responses for delete to authenticated
using (public.can_edit_assessment(assessment_id));

create policy assessment_snapshots_read_participants
on public.assessment_submission_snapshots for select to authenticated
using (public.can_view_assessment(assessment_id));

create policy documents_read_participants
on public.documents for select to authenticated
using (public.can_access_relationship(supplier_relationship_id));

create policy document_versions_read_participants
on public.document_versions for select to authenticated
using (public.can_view_document(document_id));

create policy document_reviews_read_buyer
on public.document_reviews for select to authenticated
using (public.can_review_assessment(assessment_id));

create policy review_tasks_read_buyer
on public.review_tasks for select to authenticated
using (
  public.is_buyer_manager(buyer_organization_id)
  or (
    assigned_to = auth.uid()
    and public.has_any_org_role(
      buyer_organization_id,
      array['buyer_reviewer', 'buyer_admin', 'buyer_owner']
    )
  )
);

create policy findings_read_buyer
on public.findings for select to authenticated
using (public.buyer_can_access_relationship(supplier_relationship_id));

create policy finding_events_read_visible
on public.finding_events for select to authenticated
using (
  exists (
    select 1
    from public.findings finding
    where finding.id = finding_events.finding_id
      and (
        public.buyer_can_access_relationship(finding.supplier_relationship_id)
        or (
          finding_events.supplier_visible
          and public.supplier_can_access_relationship(finding.supplier_relationship_id)
        )
      )
  )
);

create policy corrective_actions_read_participants
on public.corrective_actions for select to authenticated
using (public.can_view_finding(finding_id));

create policy risk_evaluations_read_buyer
on public.risk_evaluations for select to authenticated
using (public.can_review_assessment(assessment_id));

create policy approval_decisions_read_buyer
on public.approval_decisions for select to authenticated
using (
  exists (
    select 1
    from public.assessments assessment
    where assessment.id = approval_decisions.assessment_id
      and public.buyer_can_access_relationship(assessment.supplier_relationship_id)
  )
);

create policy notifications_read_recipients
on public.notifications for select to authenticated
using (
  public.is_org_member(organization_id)
  and (user_id is null or user_id = auth.uid())
);
create policy notifications_update_recipients
on public.notifications for update to authenticated
using (
  public.is_org_member(organization_id)
  and (user_id is null or user_id = auth.uid())
)
with check (
  public.is_org_member(organization_id)
  and (user_id is null or user_id = auth.uid())
  and status in ('unread', 'read', 'archived')
);

create policy audit_events_read_own_org
on public.audit_events for select to authenticated
using (public.is_org_member(organization_id));

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.organizations to authenticated;
grant select, insert, update on public.organization_members to authenticated;
grant select, insert, update on public.supplier_profiles to authenticated;
grant select on public.supplier_relationships to authenticated;
grant select on public.supplier_invitations to authenticated;
grant select, insert, update, delete on public.qualification_programs to authenticated;
grant select, insert, update, delete on public.program_versions to authenticated;
grant select, insert, update, delete on public.questionnaire_sections to authenticated;
grant select, insert, update, delete on public.questions to authenticated;
grant select, insert, update, delete on public.question_options to authenticated;
grant select, insert, update, delete on public.document_requirements to authenticated;
grant select on public.assessments to authenticated;
grant select, insert, update, delete on public.assessment_responses to authenticated;
grant select on public.assessment_submission_snapshots to authenticated;
grant select on public.documents to authenticated;
grant select on public.document_versions to authenticated;
grant select on public.finding_events to authenticated;
grant select on public.corrective_actions to authenticated;
grant select, update on public.notifications to authenticated;
grant select on public.audit_events to authenticated;

-- These views are owned by the migration owner and deliberately security
-- definer-style. Each view contains an authorization predicate based on
-- auth.uid(), uses a security barrier, and exposes only the appropriate fields.
create or replace view public.document_reviews_visible
with (security_barrier = true)
as
select
  review.id,
  review.assessment_id,
  review.document_version_id,
  review.reviewer_user_id,
  review.status,
  review.reviewer_note,
  case
    when public.can_review_assessment(review.assessment_id) then review.internal_note
    else null
  end as internal_note,
  review.reviewed_at,
  review.created_at
from public.document_reviews review
where public.can_view_assessment(review.assessment_id);

create or replace view public.findings_visible
with (security_barrier = true)
as
select
  finding.id,
  finding.assessment_id,
  finding.buyer_organization_id,
  finding.supplier_relationship_id,
  finding.finding_number,
  finding.severity,
  finding.category,
  finding.title,
  finding.description,
  finding.status,
  case
    when public.buyer_can_access_relationship(finding.supplier_relationship_id)
      then finding.internal_note
    else null
  end as internal_note,
  finding.raised_by,
  finding.assigned_supplier_user_id,
  finding.due_at,
  finding.raised_at,
  finding.closed_at
from public.findings finding
where public.can_access_relationship(finding.supplier_relationship_id);

create or replace view public.approval_decisions_visible
with (security_barrier = true)
as
select
  decision.id,
  decision.assessment_id,
  decision.buyer_organization_id,
  decision.decision,
  decision.effective_from,
  decision.valid_until,
  decision.conditions,
  case
    when public.can_review_assessment(decision.assessment_id)
      then decision.internal_rationale
    else null
  end as internal_rationale,
  decision.decided_by,
  decision.decided_at,
  decision.created_at
from public.approval_decisions decision
where public.can_view_assessment(decision.assessment_id);

create or replace view public.risk_evaluations_visible
with (security_barrier = true)
as
select evaluation.*
from public.risk_evaluations evaluation
where public.can_review_assessment(evaluation.assessment_id);

revoke all on public.document_reviews_visible from public, anon;
revoke all on public.findings_visible from public, anon;
revoke all on public.approval_decisions_visible from public, anon;
revoke all on public.risk_evaluations_visible from public, anon;
grant select on public.document_reviews_visible to authenticated;
grant select on public.findings_visible to authenticated;
grant select on public.approval_decisions_visible to authenticated;
grant select on public.risk_evaluations_visible to authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

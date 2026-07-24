-- Transactional workflow operations and explicit state machines.

create or replace function public.sanitize_audit_json(payload jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select coalesce(payload, '{}'::jsonb)
    - 'invitation_token_hash'
    - 'token'
    - 'password'
    - 'secret'
    - 'service_role_key'
    - 'signed_url'
$$;

create or replace function public.record_audit_event(
  target_organization_id uuid,
  target_relationship_id uuid,
  actor_organization uuid,
  action_name text,
  target_resource_type text,
  target_resource_id uuid,
  previous_values jsonb default '{}'::jsonb,
  resulting_values jsonb default '{}'::jsonb,
  target_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  audit_id uuid;
begin
  insert into public.audit_events (
    organization_id,
    relationship_id,
    actor_user_id,
    actor_organization_id,
    action,
    resource_type,
    resource_id,
    old_values,
    new_values,
    correlation_id
  ) values (
    target_organization_id,
    target_relationship_id,
    auth.uid(),
    actor_organization,
    action_name,
    target_resource_type,
    target_resource_id,
    public.sanitize_audit_json(previous_values),
    public.sanitize_audit_json(resulting_values),
    target_correlation_id
  )
  returning id into audit_id;
  return audit_id;
end;
$$;

revoke all on function public.record_audit_event(
  uuid, uuid, uuid, text, text, uuid, jsonb, jsonb, uuid
) from public, anon, authenticated;

create or replace function public.is_legal_relationship_transition(
  current_status text,
  requested_status text
)
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select case current_status
    when 'invited' then requested_status in ('active', 'terminated')
    when 'active' then requested_status in ('suspended', 'terminated')
    when 'suspended' then requested_status in ('active', 'terminated')
    else false
  end
$$;

create or replace function public.is_legal_assessment_transition(
  current_status text,
  requested_status text
)
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select case current_status
    when 'draft' then requested_status in ('in_progress', 'submitted', 'withdrawn')
    when 'in_progress' then requested_status in ('submitted', 'withdrawn')
    when 'submitted' then requested_status in ('under_review', 'withdrawn')
    when 'under_review' then requested_status in (
      'changes_requested', 'approved', 'conditionally_approved', 'rejected'
    )
    when 'changes_requested' then requested_status in ('resubmitted', 'withdrawn')
    when 'resubmitted' then requested_status in ('under_review', 'withdrawn')
    else false
  end
$$;

create or replace function public.is_legal_finding_transition(
  current_status text,
  requested_status text
)
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select case current_status
    when 'open' then requested_status in ('response_required', 'closed')
    when 'response_required' then requested_status = 'response_submitted'
    when 'response_submitted' then requested_status in ('verification_required', 'verified', 'rejected')
    when 'verification_required' then requested_status in ('verified', 'rejected')
    when 'rejected' then requested_status = 'response_submitted'
    when 'verified' then requested_status = 'closed'
    else false
  end
$$;

create or replace function public.is_legal_corrective_action_transition(
  current_status text,
  requested_status text
)
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select case current_status
    when 'draft' then requested_status = 'submitted'
    when 'submitted' then requested_status in ('accepted', 'revision_required')
    when 'revision_required' then requested_status = 'submitted'
    when 'accepted' then requested_status = 'completed'
    else false
  end
$$;

create or replace function public.is_legal_document_version_transition(
  current_status text,
  requested_status text
)
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select case current_status
    when 'pending_upload' then requested_status in ('uploaded', 'rejected')
    when 'uploaded' then requested_status in ('processing', 'rejected')
    when 'processing' then requested_status in ('ready', 'rejected')
    when 'ready' then requested_status = 'superseded'
    else false
  end
$$;

create or replace function public.is_question_visible(
  target_assessment_id uuid,
  target_question_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  rule jsonb;
  controller_key text;
  comparison_operator text;
  expected_value jsonb;
  actual_value jsonb;
  controller_question_id uuid;
  controller_type text;
  controller_response public.assessment_responses;
begin
  if auth.role() <> 'service_role'
    and not public.can_view_assessment(target_assessment_id) then
    return false;
  end if;

  select question.conditional_visibility_rules
  into rule
  from public.questions question
  join public.assessments assessment
    on assessment.id = target_assessment_id
   and assessment.program_version_id = question.program_version_id
  where question.id = target_question_id;

  if rule is null then
    return false;
  end if;
  if rule = '{}'::jsonb then
    return true;
  end if;

  controller_key := rule->>'question_key';
  comparison_operator := coalesce(rule->>'operator', 'equals');
  expected_value := rule->'value';

  select question.id, question.answer_type
  into controller_question_id, controller_type
  from public.questions question
  join public.assessments assessment
    on assessment.id = target_assessment_id
   and assessment.program_version_id = question.program_version_id
  where question.stable_question_key = controller_key;

  if controller_question_id is null then
    return false;
  end if;

  select *
  into controller_response
  from public.assessment_responses response
  where response.assessment_id = target_assessment_id
    and response.question_id = controller_question_id;

  if controller_response.id is not null then
    actual_value := case controller_type
      when 'text' then to_jsonb(controller_response.response_text)
      when 'long_text' then to_jsonb(controller_response.response_text)
      when 'number' then to_jsonb(controller_response.response_number)
      when 'boolean' then to_jsonb(controller_response.response_boolean)
      when 'date' then to_jsonb(controller_response.response_date::text)
      when 'multi_select' then controller_response.response_json
      when 'single_select' then (
        select to_jsonb(option.value)
        from public.question_options option
        where option.id = controller_response.response_option_id
      )
      else null
    end;
  end if;

  return case comparison_operator
    when 'exists' then actual_value is not null
    when 'equals' then actual_value = expected_value
    when 'not_equals' then actual_value is distinct from expected_value
    when 'contains' then
      jsonb_typeof(actual_value) = 'array'
      and actual_value @> jsonb_build_array(expected_value)
    else false
  end;
end;
$$;

create or replace function public.enforce_document_version_transition()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.upload_status is distinct from old.upload_status
    and not public.is_legal_document_version_transition(
      old.upload_status,
      new.upload_status
    ) then
    raise exception 'illegal document-version transition: % -> %',
      old.upload_status, new.upload_status using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger document_version_state_machine
before update of upload_status on public.document_versions
for each row execute function public.enforce_document_version_transition();

create or replace function public.create_organization_with_owner(
  requested_type text,
  requested_legal_name text,
  requested_display_name text,
  requested_slug text,
  requested_country_code text
)
returns public.organizations
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  created_organization public.organizations;
  owner_role text;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if requested_type not in ('buyer', 'supplier') then
    raise exception 'invalid organization type' using errcode = '22023';
  end if;

  owner_role := requested_type || '_owner';
  insert into public.organizations (
    organization_type,
    legal_name,
    display_name,
    slug,
    country_code,
    created_by
  ) values (
    requested_type,
    trim(requested_legal_name),
    trim(requested_display_name),
    lower(trim(requested_slug)),
    upper(trim(requested_country_code)),
    auth.uid()
  )
  returning * into created_organization;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    membership_status,
    joined_at
  ) values (
    created_organization.id,
    auth.uid(),
    owner_role,
    'active',
    now()
  );

  if requested_type = 'supplier' then
    insert into public.supplier_profiles (supplier_organization_id)
    values (created_organization.id);
  end if;

  perform public.record_audit_event(
    created_organization.id,
    null,
    created_organization.id,
    'organization.created',
    'organization',
    created_organization.id,
    '{}'::jsonb,
    jsonb_build_object(
      'organization_type', created_organization.organization_type,
      'display_name', created_organization.display_name
    )
  );
  return created_organization;
end;
$$;

create or replace function public.create_supplier_invitation(
  target_buyer_organization_id uuid,
  requested_supplier_name text,
  requested_email text,
  generated_token_hash text,
  generated_token_prefix text,
  requested_expiry timestamptz
)
returns public.supplier_invitations
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  created_invitation public.supplier_invitations;
begin
  if not public.is_buyer_manager(target_buyer_organization_id) then
    raise exception 'buyer owner or administrator required' using errcode = '42501';
  end if;
  if requested_expiry <= now() or requested_expiry > now() + interval '30 days' then
    raise exception 'invitation expiry must be within 30 days' using errcode = '22023';
  end if;

  update public.supplier_invitations
  set status = 'revoked'
  where buyer_organization_id = target_buyer_organization_id
    and invited_email = lower(trim(requested_email))
    and status = 'pending';

  insert into public.supplier_invitations (
    buyer_organization_id,
    intended_supplier_name,
    invited_email,
    invitation_token_hash,
    token_prefix,
    expires_at,
    created_by
  ) values (
    target_buyer_organization_id,
    trim(requested_supplier_name),
    lower(trim(requested_email)),
    generated_token_hash,
    generated_token_prefix,
    requested_expiry,
    auth.uid()
  )
  returning * into created_invitation;

  perform public.record_audit_event(
    target_buyer_organization_id,
    null,
    target_buyer_organization_id,
    'supplier_invitation.created',
    'supplier_invitation',
    created_invitation.id,
    '{}'::jsonb,
    jsonb_build_object(
      'intended_supplier_name', created_invitation.intended_supplier_name,
      'invited_email', created_invitation.invited_email,
      'expires_at', created_invitation.expires_at
    )
  );
  return created_invitation;
end;
$$;

create or replace function public.accept_supplier_invitation(
  presented_token_hash text,
  target_supplier_organization_id uuid
)
returns public.supplier_relationships
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  invitation_record public.supplier_invitations;
  relationship_record public.supplier_relationships;
  requestor_email text;
  correlation uuid := gen_random_uuid();
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.is_supplier_manager(target_supplier_organization_id) then
    raise exception 'supplier owner or administrator required' using errcode = '42501';
  end if;

  select *
  into invitation_record
  from public.supplier_invitations
  where invitation_token_hash = presented_token_hash
  for update;

  if invitation_record.id is null then
    raise exception 'invitation is invalid' using errcode = '22023';
  end if;
  if invitation_record.status <> 'pending' then
    raise exception 'invitation is no longer pending' using errcode = '22023';
  end if;
  if invitation_record.expires_at <= now() then
    update public.supplier_invitations
    set status = 'expired'
    where id = invitation_record.id;
    raise exception 'invitation has expired' using errcode = '22023';
  end if;

  requestor_email := public.request_email();
  if requestor_email is null or requestor_email <> invitation_record.invited_email then
    raise exception 'invitation email does not match authenticated user' using errcode = '42501';
  end if;

  insert into public.supplier_relationships (
    buyer_organization_id,
    supplier_organization_id,
    buyer_supplier_code,
    relationship_status,
    onboarding_status,
    supplier_owner_user_id,
    invited_at,
    accepted_at
  ) values (
    invitation_record.buyer_organization_id,
    target_supplier_organization_id,
    'SUP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    'active',
    'profile_pending',
    auth.uid(),
    invitation_record.created_at,
    now()
  )
  returning * into relationship_record;

  update public.supplier_invitations
  set
    status = 'accepted',
    accepted_by_user_id = auth.uid(),
    resulting_supplier_organization_id = target_supplier_organization_id,
    accepted_at = now()
  where id = invitation_record.id;

  perform public.record_audit_event(
    invitation_record.buyer_organization_id,
    relationship_record.id,
    target_supplier_organization_id,
    'supplier_invitation.accepted',
    'supplier_relationship',
    relationship_record.id,
    '{}'::jsonb,
    jsonb_build_object('status', 'active'),
    correlation
  );
  perform public.record_audit_event(
    target_supplier_organization_id,
    relationship_record.id,
    target_supplier_organization_id,
    'supplier_relationship.activated',
    'supplier_relationship',
    relationship_record.id,
    '{}'::jsonb,
    jsonb_build_object('status', 'active'),
    correlation
  );
  return relationship_record;
end;
$$;

create or replace function public.transition_supplier_relationship(
  target_relationship_id uuid,
  requested_status text,
  reason text
)
returns public.supplier_relationships
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  relationship_record public.supplier_relationships;
  previous_status text;
begin
  select * into relationship_record
  from public.supplier_relationships
  where id = target_relationship_id
  for update;

  if relationship_record.id is null then
    raise exception 'supplier relationship not found' using errcode = 'P0002';
  end if;
  if not public.is_buyer_manager(relationship_record.buyer_organization_id) then
    raise exception 'relationship transition is not authorized' using errcode = '42501';
  end if;
  if not public.is_legal_relationship_transition(
    relationship_record.relationship_status,
    requested_status
  ) then
    raise exception 'illegal relationship transition: % -> %',
      relationship_record.relationship_status, requested_status
      using errcode = '22023';
  end if;
  if length(trim(reason)) < 2 then
    raise exception 'transition reason is required' using errcode = '22023';
  end if;

  previous_status := relationship_record.relationship_status;
  update public.supplier_relationships
  set
    relationship_status = requested_status,
    accepted_at = case
      when requested_status = 'active' then coalesce(accepted_at, now())
      else accepted_at
    end,
    suspended_at = case
      when requested_status = 'suspended' then now()
      when requested_status = 'active' then null
      else suspended_at
    end
  where id = target_relationship_id
  returning * into relationship_record;

  perform public.record_audit_event(
    relationship_record.buyer_organization_id,
    relationship_record.id,
    relationship_record.buyer_organization_id,
    'supplier_relationship.status_changed',
    'supplier_relationship',
    relationship_record.id,
    jsonb_build_object('status', previous_status),
    jsonb_build_object('status', requested_status, 'reason', trim(reason))
  );
  return relationship_record;
end;
$$;

create or replace function public.publish_program_version(
  target_program_version_id uuid,
  requested_effective_from date default current_date
)
returns public.program_versions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  version_record public.program_versions;
  program_record public.qualification_programs;
begin
  select *
  into version_record
  from public.program_versions
  where id = target_program_version_id
  for update;

  select *
  into program_record
  from public.qualification_programs
  where id = version_record.qualification_program_id
  for update;

  if version_record.id is null then
    raise exception 'program version not found' using errcode = 'P0002';
  end if;
  if not public.is_buyer_manager(program_record.buyer_organization_id) then
    raise exception 'program publishing is not authorized' using errcode = '42501';
  end if;
  if version_record.status <> 'draft' then
    raise exception 'only draft versions can be published' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.questionnaire_sections
    where program_version_id = version_record.id
  ) or not exists (
    select 1 from public.questions
    where program_version_id = version_record.id
  ) then
    raise exception 'program version requires at least one section and question'
      using errcode = '23514';
  end if;

  update public.program_versions
  set status = 'retired'
  where qualification_program_id = version_record.qualification_program_id
    and status = 'active';

  update public.program_versions
  set
    status = 'active',
    effective_from = requested_effective_from,
    published_by = auth.uid(),
    published_at = now()
  where id = target_program_version_id
  returning * into version_record;

  update public.qualification_programs
  set
    current_version_id = version_record.id,
    status = 'active'
  where id = version_record.qualification_program_id;

  perform public.record_audit_event(
    program_record.buyer_organization_id,
    null,
    program_record.buyer_organization_id,
    'qualification_program.version_published',
    'program_version',
    version_record.id,
    '{}'::jsonb,
    jsonb_build_object(
      'version_number', version_record.version_number,
      'effective_from', version_record.effective_from
    )
  );
  return version_record;
end;
$$;

create or replace function public.create_assessment(
  target_relationship_id uuid,
  target_program_id uuid,
  supplier_assignee uuid default null,
  buyer_reviewer uuid default null
)
returns public.assessments
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  relationship_record public.supplier_relationships;
  program_record public.qualification_programs;
  created_assessment public.assessments;
begin
  select * into relationship_record
  from public.supplier_relationships
  where id = target_relationship_id
  for share;

  select * into program_record
  from public.qualification_programs
  where id = target_program_id
  for share;

  if relationship_record.id is null or program_record.id is null then
    raise exception 'relationship or program not found' using errcode = 'P0002';
  end if;
  if not public.is_buyer_manager(relationship_record.buyer_organization_id) then
    raise exception 'assessment creation is not authorized' using errcode = '42501';
  end if;
  if relationship_record.relationship_status <> 'active'
    or program_record.status <> 'active'
    or program_record.current_version_id is null
    or program_record.buyer_organization_id <> relationship_record.buyer_organization_id then
    raise exception 'active relationship and active buyer program are required'
      using errcode = '22023';
  end if;
  if supplier_assignee is not null and not exists (
    select 1 from public.organization_members
    where organization_id = relationship_record.supplier_organization_id
      and user_id = supplier_assignee
      and membership_status = 'active'
      and role in ('supplier_owner', 'supplier_admin', 'supplier_contributor')
  ) then
    raise exception 'supplier assignee is not an active contributor' using errcode = '22023';
  end if;
  if buyer_reviewer is not null and not exists (
    select 1 from public.organization_members
    where organization_id = relationship_record.buyer_organization_id
      and user_id = buyer_reviewer
      and membership_status = 'active'
      and role in ('buyer_owner', 'buyer_admin', 'buyer_reviewer')
  ) then
    raise exception 'buyer reviewer is not eligible' using errcode = '22023';
  end if;

  insert into public.assessments (
    supplier_relationship_id,
    qualification_program_id,
    program_version_id,
    assigned_supplier_user_id,
    assigned_buyer_reviewer_id
  ) values (
    relationship_record.id,
    program_record.id,
    program_record.current_version_id,
    supplier_assignee,
    buyer_reviewer
  )
  returning * into created_assessment;

  insert into public.notifications (
    organization_id,
    user_id,
    related_resource_type,
    related_resource_id,
    notification_type,
    title,
    body
  ) values (
    relationship_record.supplier_organization_id,
    supplier_assignee,
    'assessment',
    created_assessment.id,
    'assessment.assigned',
    'Qualification assessment assigned',
    'A fictional buyer has assigned a supplier qualification assessment.'
  );

  perform public.record_audit_event(
    relationship_record.buyer_organization_id,
    relationship_record.id,
    relationship_record.buyer_organization_id,
    'assessment.created',
    'assessment',
    created_assessment.id,
    '{}'::jsonb,
    jsonb_build_object(
      'program_version_id', created_assessment.program_version_id,
      'status', created_assessment.status
    )
  );
  return created_assessment;
end;
$$;

create or replace function public.create_document_version(
  target_assessment_id uuid,
  target_requirement_id uuid,
  requested_filename text,
  requested_mime_type text,
  requested_byte_size bigint,
  expected_sha256 text,
  requested_issue_date date default null,
  requested_expiry_date date default null,
  requested_issuing_body text default null
)
returns public.document_versions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  assessment_record public.assessments;
  relationship_record public.supplier_relationships;
  requirement_record public.document_requirements;
  document_record public.documents;
  version_record public.document_versions;
  next_version integer;
  normalized_filename text;
  new_document_id uuid := gen_random_uuid();
  new_version_id uuid := gen_random_uuid();
begin
  if not public.can_edit_assessment(target_assessment_id) then
    raise exception 'document upload is not authorized' using errcode = '42501';
  end if;

  select * into assessment_record
  from public.assessments where id = target_assessment_id for share;
  select * into relationship_record
  from public.supplier_relationships
  where id = assessment_record.supplier_relationship_id for share;
  select * into requirement_record
  from public.document_requirements
  where id = target_requirement_id
    and program_version_id = assessment_record.program_version_id;

  if requirement_record.id is null then
    raise exception 'document requirement is not part of this assessment'
      using errcode = '22023';
  end if;
  if requested_mime_type <> all(requirement_record.accepted_mime_types)
    or requested_byte_size > requirement_record.maximum_size_bytes then
    raise exception 'document type or size violates the requirement'
      using errcode = '22023';
  end if;
  if requirement_record.requires_issue_date and requested_issue_date is null then
    raise exception 'issue date is required' using errcode = '22023';
  end if;
  if requirement_record.requires_expiry_date and requested_expiry_date is null then
    raise exception 'expiry date is required' using errcode = '22023';
  end if;
  if requested_expiry_date is not null
    and requested_expiry_date < current_date + requirement_record.minimum_validity_days then
    raise exception 'document validity period is too short' using errcode = '22023';
  end if;

  normalized_filename := regexp_replace(
    regexp_replace(trim(requested_filename), '[^A-Za-z0-9._-]+', '-', 'g'),
    '^-+|-+$',
    '',
    'g'
  );
  if normalized_filename = '' or length(normalized_filename) > 200 then
    raise exception 'filename cannot be safely normalized' using errcode = '22023';
  end if;

  select *
  into document_record
  from public.documents
  where supplier_relationship_id = assessment_record.supplier_relationship_id
    and document_requirement_id = target_requirement_id
  for update;

  if document_record.id is null then
    insert into public.documents (
      id,
      supplier_relationship_id,
      supplier_organization_id,
      document_requirement_id,
      document_type,
      created_by
    ) values (
      new_document_id,
      assessment_record.supplier_relationship_id,
      relationship_record.supplier_organization_id,
      target_requirement_id,
      requirement_record.stable_requirement_key,
      auth.uid()
    )
    returning * into document_record;
  end if;

  select coalesce(max(version_number), 0) + 1
  into next_version
  from public.document_versions
  where document_id = document_record.id;

  insert into public.document_versions (
    id,
    document_id,
    version_number,
    storage_path,
    original_filename,
    sanitized_filename,
    mime_type,
    byte_size,
    sha256_hash,
    issue_date,
    expiry_date,
    issuing_body,
    uploaded_by
  ) values (
    new_version_id,
    document_record.id,
    next_version,
    relationship_record.buyer_organization_id::text || '/'
      || relationship_record.id::text || '/'
      || document_record.id::text || '/'
      || next_version::text || '/'
      || normalized_filename,
    trim(requested_filename),
    normalized_filename,
    requested_mime_type,
    requested_byte_size,
    expected_sha256,
    requested_issue_date,
    requested_expiry_date,
    nullif(trim(requested_issuing_body), ''),
    auth.uid()
  )
  returning * into version_record;

  perform public.record_audit_event(
    relationship_record.supplier_organization_id,
    relationship_record.id,
    relationship_record.supplier_organization_id,
    'document_version.created',
    'document_version',
    version_record.id,
    '{}'::jsonb,
    jsonb_build_object(
      'document_id', document_record.id,
      'version_number', version_record.version_number,
      'mime_type', version_record.mime_type,
      'byte_size', version_record.byte_size
    )
  );
  return version_record;
end;
$$;

create or replace function public.finalize_document_upload(
  target_document_version_id uuid,
  verified_sha256 text,
  verified_byte_size bigint
)
returns public.document_versions
language plpgsql
security definer
set search_path = pg_catalog, public, pgmq
as $$
declare
  version_record public.document_versions;
  document_record public.documents;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  select * into version_record
  from public.document_versions
  where id = target_document_version_id
  for update;
  if version_record.id is null then
    raise exception 'document version not found' using errcode = 'P0002';
  end if;
  if version_record.upload_status <> 'pending_upload' then
    raise exception 'document version is not awaiting upload' using errcode = '22023';
  end if;

  select * into document_record
  from public.documents where id = version_record.document_id for update;

  if document_record.current_version_id is not null then
    update public.document_versions
    set upload_status = 'superseded', superseded_at = now()
    where id = document_record.current_version_id
      and upload_status = 'ready';
  end if;

  update public.document_versions
  set
    sha256_hash = verified_sha256,
    byte_size = verified_byte_size,
    upload_status = 'uploaded',
    processing_status = 'pending',
    uploaded_at = now()
  where id = target_document_version_id
  returning * into version_record;

  update public.documents
  set
    current_version_id = version_record.id,
    status = 'submitted'
  where id = document_record.id;

  perform pgmq.send(
    'document_processing',
    jsonb_build_object(
      'document_version_id', version_record.id,
      'correlation_id', gen_random_uuid()
    )
  );
  return version_record;
end;
$$;

create or replace function public.complete_document_processing(
  target_document_version_id uuid,
  processing_succeeded boolean,
  safe_error_code text default null
)
returns public.document_versions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  version_record public.document_versions;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  select * into version_record
  from public.document_versions
  where id = target_document_version_id
  for update;
  if version_record.upload_status not in ('uploaded', 'processing') then
    raise exception 'document is not processing' using errcode = '22023';
  end if;

  if version_record.upload_status = 'uploaded' then
    update public.document_versions
    set upload_status = 'processing', processing_status = 'processing'
    where id = target_document_version_id
    returning * into version_record;
  end if;

  update public.document_versions
  set
    upload_status = case when processing_succeeded then 'ready' else 'rejected' end,
    processing_status = case when processing_succeeded then 'complete' else 'failed' end,
    processing_error = case when processing_succeeded then null else left(safe_error_code, 200) end
  where id = target_document_version_id
  returning * into version_record;
  return version_record;
end;
$$;

create or replace function public.submit_assessment(
  target_assessment_id uuid,
  declaration_text text
)
returns public.assessments
language plpgsql
security definer
set search_path = pg_catalog, public, pgmq
as $$
declare
  assessment_record public.assessments;
  relationship_record public.supplier_relationships;
  required_questions integer;
  answered_questions integer;
  required_documents integer;
  ready_documents integer;
  submission_number integer;
  next_status text;
  completeness numeric(5, 2);
  correlation uuid := gen_random_uuid();
begin
  select * into assessment_record
  from public.assessments
  where id = target_assessment_id
  for update;

  if assessment_record.id is null then
    raise exception 'assessment not found' using errcode = 'P0002';
  end if;
  if not public.can_edit_assessment(target_assessment_id) then
    raise exception 'assessment submission is not authorized' using errcode = '42501';
  end if;
  if length(trim(declaration_text)) < 10 then
    raise exception 'supplier declaration is required' using errcode = '22023';
  end if;

  select * into relationship_record
  from public.supplier_relationships
  where id = assessment_record.supplier_relationship_id;

  select count(*) into required_questions
  from public.questions question
  where question.program_version_id = assessment_record.program_version_id
    and question.required
    and public.is_question_visible(assessment_record.id, question.id);

  select count(*) into answered_questions
  from public.assessment_responses response
  join public.questions question on question.id = response.question_id
  where response.assessment_id = assessment_record.id
    and question.required
    and public.is_question_visible(assessment_record.id, question.id);

  select count(*) into required_documents
  from public.document_requirements
  where program_version_id = assessment_record.program_version_id
    and required;

  select count(*) into ready_documents
  from public.document_requirements requirement
  where requirement.program_version_id = assessment_record.program_version_id
    and requirement.required
    and exists (
      select 1
      from public.documents document
      join public.document_versions version
        on version.id = document.current_version_id
      where document.supplier_relationship_id = assessment_record.supplier_relationship_id
        and document.document_requirement_id = requirement.id
        and version.upload_status = 'ready'
        and (
          not requirement.requires_expiry_date
          or version.expiry_date >= current_date + requirement.minimum_validity_days
        )
    );

  completeness := case
    when required_questions + required_documents = 0 then 100
    else round(
      100.0 * (answered_questions + ready_documents)
      / (required_questions + required_documents),
      2
    )
  end;

  if answered_questions <> required_questions or ready_documents <> required_documents then
    raise exception 'assessment is incomplete: %/% required responses and %/% required documents',
      answered_questions, required_questions, ready_documents, required_documents
      using errcode = '23514';
  end if;

  next_status := case
    when assessment_record.status = 'changes_requested' then 'resubmitted'
    else 'submitted'
  end;
  if not public.is_legal_assessment_transition(assessment_record.status, next_status) then
    raise exception 'illegal assessment transition: % -> %',
      assessment_record.status, next_status using errcode = '22023';
  end if;

  select coalesce(max(snapshot.submission_number), 0) + 1
  into submission_number
  from public.assessment_submission_snapshots snapshot
  where snapshot.assessment_id = assessment_record.id;

  insert into public.assessment_submission_snapshots (
    assessment_id,
    submission_number,
    submitted_by,
    responses_snapshot,
    documents_snapshot,
    declaration,
    completeness_percentage
  ) values (
    assessment_record.id,
    submission_number,
    auth.uid(),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'question_id', response.question_id,
          'response_text', response.response_text,
          'response_number', response.response_number,
          'response_boolean', response.response_boolean,
          'response_date', response.response_date,
          'response_option_id', response.response_option_id,
          'response_json', response.response_json,
          'answered_at', response.answered_at
        )
        order by question.display_order
      )
      from public.assessment_responses response
      join public.questions question on question.id = response.question_id
      where response.assessment_id = assessment_record.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'document_id', document.id,
          'document_version_id', version.id,
          'requirement_id', document.document_requirement_id,
          'version_number', version.version_number,
          'sha256_hash', version.sha256_hash,
          'expiry_date', version.expiry_date
        )
        order by requirement.display_order
      )
      from public.documents document
      join public.document_versions version on version.id = document.current_version_id
      join public.document_requirements requirement
        on requirement.id = document.document_requirement_id
      where document.supplier_relationship_id = assessment_record.supplier_relationship_id
        and requirement.program_version_id = assessment_record.program_version_id
        and version.upload_status = 'ready'
    ), '[]'::jsonb),
    trim(declaration_text),
    completeness
  );

  update public.assessments
  set
    status = next_status,
    started_at = coalesce(started_at, now()),
    submitted_at = now(),
    completeness_percentage = completeness,
    supplier_declaration = trim(declaration_text)
  where id = assessment_record.id
  returning * into assessment_record;

  if assessment_record.assigned_buyer_reviewer_id is not null then
    insert into public.review_tasks (
      assessment_id,
      buyer_organization_id,
      assigned_to,
      task_type,
      due_at
    ) values (
      assessment_record.id,
      relationship_record.buyer_organization_id,
      assessment_record.assigned_buyer_reviewer_id,
      'initial_review',
      now() + interval '7 days'
    )
    on conflict do nothing;
  end if;

  insert into public.notifications (
    organization_id,
    user_id,
    related_resource_type,
    related_resource_id,
    notification_type,
    title,
    body
  ) values (
    relationship_record.buyer_organization_id,
    assessment_record.assigned_buyer_reviewer_id,
    'assessment',
    assessment_record.id,
    'assessment.submitted',
    'Supplier assessment submitted',
    'A synthetic supplier assessment is ready for review.'
  );

  perform pgmq.send(
    'risk_recalculation',
    jsonb_build_object(
      'assessment_id', assessment_record.id,
      'correlation_id', correlation
    )
  );

  perform public.record_audit_event(
    relationship_record.supplier_organization_id,
    relationship_record.id,
    relationship_record.supplier_organization_id,
    'assessment.submitted',
    'assessment',
    assessment_record.id,
    jsonb_build_object('status', case when next_status = 'resubmitted' then 'changes_requested' else 'in_progress' end),
    jsonb_build_object(
      'status', next_status,
      'submission_number', submission_number,
      'completeness_percentage', completeness
    ),
    correlation
  );
  perform public.record_audit_event(
    relationship_record.buyer_organization_id,
    relationship_record.id,
    relationship_record.supplier_organization_id,
    'assessment.received',
    'assessment',
    assessment_record.id,
    '{}'::jsonb,
    jsonb_build_object('status', next_status),
    correlation
  );
  return assessment_record;
end;
$$;

create or replace function public.start_assessment_review(target_assessment_id uuid)
returns public.assessments
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  assessment_record public.assessments;
  relationship_record public.supplier_relationships;
begin
  select * into assessment_record
  from public.assessments where id = target_assessment_id for update;
  if assessment_record.id is null then
    raise exception 'assessment not found' using errcode = 'P0002';
  end if;
  if not public.can_review_assessment(target_assessment_id) then
    raise exception 'assessment review is not authorized' using errcode = '42501';
  end if;
  if not public.is_legal_assessment_transition(assessment_record.status, 'under_review') then
    raise exception 'assessment cannot enter review from status %', assessment_record.status
      using errcode = '22023';
  end if;

  select * into relationship_record
  from public.supplier_relationships
  where id = assessment_record.supplier_relationship_id;

  update public.assessments
  set status = 'under_review', review_started_at = coalesce(review_started_at, now())
  where id = target_assessment_id
  returning * into assessment_record;

  update public.review_tasks
  set status = 'in_progress'
  where assessment_id = target_assessment_id
    and assigned_to = auth.uid()
    and status = 'pending';

  perform public.record_audit_event(
    relationship_record.buyer_organization_id,
    relationship_record.id,
    relationship_record.buyer_organization_id,
    'assessment.review_started',
    'assessment',
    assessment_record.id,
    jsonb_build_object('status', 'submitted'),
    jsonb_build_object('status', 'under_review')
  );
  return assessment_record;
end;
$$;

create or replace function public.request_assessment_changes(
  target_assessment_id uuid,
  supplier_message text
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
  select * into assessment_record
  from public.assessments where id = target_assessment_id for update;
  if not public.can_review_assessment(target_assessment_id) then
    raise exception 'change request is not authorized' using errcode = '42501';
  end if;
  if assessment_record.status <> 'under_review' then
    raise exception 'changes can be requested only during review' using errcode = '22023';
  end if;
  if length(trim(supplier_message)) < 2 then
    raise exception 'supplier-visible change message is required' using errcode = '22023';
  end if;

  select * into relationship_record from public.supplier_relationships
  where id = assessment_record.supplier_relationship_id;

  update public.assessments
  set status = 'changes_requested'
  where id = target_assessment_id
  returning * into assessment_record;

  insert into public.notifications (
    organization_id, user_id, related_resource_type, related_resource_id,
    notification_type, title, body
  ) values (
    relationship_record.supplier_organization_id,
    assessment_record.assigned_supplier_user_id,
    'assessment',
    assessment_record.id,
    'assessment.changes_requested',
    'Assessment changes requested',
    left(trim(supplier_message), 1000)
  );
  perform public.record_audit_event(
    relationship_record.buyer_organization_id,
    relationship_record.id,
    relationship_record.buyer_organization_id,
    'assessment.changes_requested',
    'assessment',
    assessment_record.id,
    jsonb_build_object('status', 'under_review'),
    jsonb_build_object('status', 'changes_requested', 'message', left(trim(supplier_message), 1000))
  );
  return assessment_record;
end;
$$;

create or replace function public.record_document_review(
  target_assessment_id uuid,
  target_document_version_id uuid,
  requested_status text,
  supplier_note text default null,
  buyer_internal_note text default null
)
returns public.document_reviews
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  review_record public.document_reviews;
  assessment_record public.assessments;
  document_record public.documents;
  relationship_record public.supplier_relationships;
begin
  if requested_status not in ('accepted', 'rejected', 'replacement_requested') then
    raise exception 'invalid document review status' using errcode = '22023';
  end if;
  if not public.can_review_assessment(target_assessment_id) then
    raise exception 'document review is not authorized' using errcode = '42501';
  end if;

  select * into assessment_record
  from public.assessments where id = target_assessment_id;
  select document.* into document_record
  from public.documents document
  join public.document_versions version on version.document_id = document.id
  where version.id = target_document_version_id
    and document.supplier_relationship_id = assessment_record.supplier_relationship_id;
  if document_record.id is null then
    raise exception 'document version is not part of this assessment relationship'
      using errcode = '22023';
  end if;

  select * into relationship_record from public.supplier_relationships
  where id = assessment_record.supplier_relationship_id;

  insert into public.document_reviews (
    assessment_id,
    document_version_id,
    reviewer_user_id,
    status,
    reviewer_note,
    internal_note,
    reviewed_at
  ) values (
    target_assessment_id,
    target_document_version_id,
    auth.uid(),
    requested_status,
    nullif(trim(supplier_note), ''),
    nullif(trim(buyer_internal_note), ''),
    now()
  )
  on conflict (assessment_id, document_version_id)
  do update set
    reviewer_user_id = excluded.reviewer_user_id,
    status = excluded.status,
    reviewer_note = excluded.reviewer_note,
    internal_note = excluded.internal_note,
    reviewed_at = excluded.reviewed_at
  returning * into review_record;

  update public.documents
  set status = case
    when requested_status = 'accepted' then 'accepted'
    when requested_status = 'replacement_requested' then 'replacement_requested'
    else status
  end
  where id = document_record.id;

  insert into public.notifications (
    organization_id, related_resource_type, related_resource_id,
    notification_type, title, body
  ) values (
    relationship_record.supplier_organization_id,
    'document',
    document_record.id,
    'document.reviewed',
    'Document review updated',
    coalesce(nullif(trim(supplier_note), ''), 'A buyer reviewer updated a document review.')
  );

  perform public.record_audit_event(
    relationship_record.buyer_organization_id,
    relationship_record.id,
    relationship_record.buyer_organization_id,
    'document.reviewed',
    'document_version',
    target_document_version_id,
    '{}'::jsonb,
    jsonb_build_object('status', requested_status)
  );
  return review_record;
end;
$$;

create or replace function public.create_assessment_finding(
  target_assessment_id uuid,
  requested_severity text,
  requested_category text,
  requested_title text,
  supplier_description text,
  buyer_internal_note text default null,
  supplier_assignee uuid default null,
  requested_due_at timestamptz default null
)
returns public.findings
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  assessment_record public.assessments;
  relationship_record public.supplier_relationships;
  created_finding public.findings;
  next_number integer;
begin
  select * into assessment_record
  from public.assessments where id = target_assessment_id for update;
  if not public.can_review_assessment(target_assessment_id) then
    raise exception 'finding creation is not authorized' using errcode = '42501';
  end if;
  if assessment_record.status not in ('under_review', 'changes_requested') then
    raise exception 'findings require an assessment under review' using errcode = '22023';
  end if;
  if requested_severity not in ('low', 'medium', 'high', 'critical') then
    raise exception 'invalid finding severity' using errcode = '22023';
  end if;

  select * into relationship_record
  from public.supplier_relationships
  where id = assessment_record.supplier_relationship_id;
  if supplier_assignee is not null and not exists (
    select 1 from public.organization_members
    where organization_id = relationship_record.supplier_organization_id
      and user_id = supplier_assignee
      and membership_status = 'active'
      and role in ('supplier_owner', 'supplier_admin', 'supplier_contributor')
  ) then
    raise exception 'finding assignee is not an active supplier contributor'
      using errcode = '22023';
  end if;

  select coalesce(max(finding_number), 0) + 1 into next_number
  from public.findings where assessment_id = target_assessment_id;

  insert into public.findings (
    assessment_id,
    buyer_organization_id,
    supplier_relationship_id,
    finding_number,
    severity,
    category,
    title,
    description,
    status,
    internal_note,
    raised_by,
    assigned_supplier_user_id,
    due_at
  ) values (
    target_assessment_id,
    relationship_record.buyer_organization_id,
    relationship_record.id,
    next_number,
    requested_severity,
    trim(requested_category),
    trim(requested_title),
    trim(supplier_description),
    'response_required',
    nullif(trim(buyer_internal_note), ''),
    auth.uid(),
    supplier_assignee,
    requested_due_at
  )
  returning * into created_finding;

  insert into public.finding_events (
    finding_id, organization_id, actor_user_id, event_type,
    supplier_visible, comment
  ) values (
    created_finding.id,
    relationship_record.buyer_organization_id,
    auth.uid(),
    'finding.created',
    true,
    created_finding.description
  );

  insert into public.notifications (
    organization_id, user_id, related_resource_type, related_resource_id,
    notification_type, title, body
  ) values (
    relationship_record.supplier_organization_id,
    supplier_assignee,
    'finding',
    created_finding.id,
    'finding.response_required',
    created_finding.title,
    created_finding.description
  );

  perform public.record_audit_event(
    relationship_record.buyer_organization_id,
    relationship_record.id,
    relationship_record.buyer_organization_id,
    'finding.created',
    'finding',
    created_finding.id,
    '{}'::jsonb,
    jsonb_build_object(
      'finding_number', created_finding.finding_number,
      'severity', created_finding.severity,
      'status', created_finding.status
    )
  );
  return created_finding;
end;
$$;

create or replace function public.submit_corrective_action(
  target_finding_id uuid,
  root_cause_text text,
  correction_text text,
  preventive_action_text text,
  completion_target date
)
returns public.corrective_actions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  finding_record public.findings;
  relationship_record public.supplier_relationships;
  action_record public.corrective_actions;
begin
  select * into finding_record
  from public.findings where id = target_finding_id for update;
  if finding_record.id is null then
    raise exception 'finding not found' using errcode = 'P0002';
  end if;
  if not public.supplier_can_access_relationship(finding_record.supplier_relationship_id) then
    raise exception 'corrective action submission is not authorized' using errcode = '42501';
  end if;
  if not public.has_any_org_role(
    (select supplier_organization_id from public.supplier_relationships
     where id = finding_record.supplier_relationship_id),
    array['supplier_owner', 'supplier_admin', 'supplier_contributor']
  ) then
    raise exception 'supplier contributor role required' using errcode = '42501';
  end if;
  if finding_record.status not in ('response_required', 'rejected') then
    raise exception 'finding is not awaiting a supplier response' using errcode = '22023';
  end if;
  if completion_target < current_date then
    raise exception 'target completion date cannot be in the past' using errcode = '22023';
  end if;

  select * into relationship_record
  from public.supplier_relationships
  where id = finding_record.supplier_relationship_id;

  insert into public.corrective_actions (
    finding_id,
    supplier_organization_id,
    submitted_by,
    root_cause,
    correction,
    preventive_action,
    target_completion_date,
    status,
    submitted_at
  ) values (
    finding_record.id,
    relationship_record.supplier_organization_id,
    auth.uid(),
    trim(root_cause_text),
    trim(correction_text),
    trim(preventive_action_text),
    completion_target,
    'submitted',
    now()
  )
  returning * into action_record;

  update public.findings
  set status = 'response_submitted'
  where id = finding_record.id;

  insert into public.finding_events (
    finding_id, organization_id, actor_user_id, event_type,
    supplier_visible, comment
  ) values (
    finding_record.id,
    relationship_record.supplier_organization_id,
    auth.uid(),
    'corrective_action.submitted',
    true,
    'Corrective action submitted for buyer verification.'
  );

  insert into public.notifications (
    organization_id, related_resource_type, related_resource_id,
    notification_type, title, body
  ) values (
    relationship_record.buyer_organization_id,
    'corrective_action',
    action_record.id,
    'corrective_action.submitted',
    'Corrective action submitted',
    'A supplier submitted a corrective action for review.'
  );

  perform public.record_audit_event(
    relationship_record.supplier_organization_id,
    relationship_record.id,
    relationship_record.supplier_organization_id,
    'corrective_action.submitted',
    'corrective_action',
    action_record.id,
    '{}'::jsonb,
    jsonb_build_object('finding_id', finding_record.id, 'status', 'submitted')
  );
  return action_record;
end;
$$;

create or replace function public.verify_corrective_action(
  target_corrective_action_id uuid,
  requested_outcome text,
  verification_comment text
)
returns public.corrective_actions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  action_record public.corrective_actions;
  finding_record public.findings;
  relationship_record public.supplier_relationships;
begin
  if requested_outcome not in ('accepted', 'revision_required') then
    raise exception 'invalid corrective-action outcome' using errcode = '22023';
  end if;
  select * into action_record
  from public.corrective_actions
  where id = target_corrective_action_id
  for update;
  select * into finding_record
  from public.findings
  where id = action_record.finding_id
  for update;

  if not public.can_review_assessment(finding_record.assessment_id) then
    raise exception 'corrective-action verification is not authorized'
      using errcode = '42501';
  end if;
  if action_record.status <> 'submitted'
    or finding_record.status <> 'response_submitted' then
    raise exception 'corrective action is not ready for verification'
      using errcode = '22023';
  end if;
  if length(trim(verification_comment)) < 2 then
    raise exception 'verification note is required' using errcode = '22023';
  end if;

  select * into relationship_record from public.supplier_relationships
  where id = finding_record.supplier_relationship_id;

  update public.corrective_actions
  set
    status = requested_outcome,
    verified_by = case when requested_outcome = 'accepted' then auth.uid() else null end,
    verified_at = case when requested_outcome = 'accepted' then now() else null end,
    verification_note = trim(verification_comment)
  where id = action_record.id
  returning * into action_record;

  update public.findings
  set status = case when requested_outcome = 'accepted' then 'verified' else 'rejected' end
  where id = finding_record.id;

  insert into public.finding_events (
    finding_id, organization_id, actor_user_id, event_type,
    supplier_visible, comment
  ) values (
    finding_record.id,
    relationship_record.buyer_organization_id,
    auth.uid(),
    'corrective_action.' || requested_outcome,
    true,
    trim(verification_comment)
  );

  perform public.record_audit_event(
    relationship_record.buyer_organization_id,
    relationship_record.id,
    relationship_record.buyer_organization_id,
    'corrective_action.' || requested_outcome,
    'corrective_action',
    action_record.id,
    jsonb_build_object('status', 'submitted'),
    jsonb_build_object('status', requested_outcome)
  );
  return action_record;
end;
$$;

create or replace function public.record_approval_decision(
  target_assessment_id uuid,
  requested_decision text,
  requested_effective_from date,
  requested_valid_until date,
  supplier_conditions text,
  buyer_internal_rationale text
)
returns public.approval_decisions
language plpgsql
security definer
set search_path = pg_catalog, public, pgmq
as $$
declare
  assessment_record public.assessments;
  relationship_record public.supplier_relationships;
  decision_record public.approval_decisions;
  resulting_status text;
  correlation uuid := gen_random_uuid();
begin
  if requested_decision not in ('approved', 'conditionally_approved', 'rejected', 'deferred') then
    raise exception 'invalid approval decision' using errcode = '22023';
  end if;

  select * into assessment_record
  from public.assessments where id = target_assessment_id for update;
  select * into relationship_record
  from public.supplier_relationships
  where id = assessment_record.supplier_relationship_id for update;

  if not public.is_buyer_manager(relationship_record.buyer_organization_id) then
    raise exception 'approval decision is not authorized' using errcode = '42501';
  end if;
  if assessment_record.status <> 'under_review' then
    raise exception 'assessment must be under review before a decision'
      using errcode = '22023';
  end if;
  if length(trim(buyer_internal_rationale)) < 2 then
    raise exception 'internal decision rationale is required' using errcode = '22023';
  end if;
  if requested_decision in ('approved', 'conditionally_approved') and exists (
    select 1 from public.findings
    where assessment_id = assessment_record.id
      and severity = 'critical'
      and status not in ('verified', 'closed')
  ) then
    raise exception 'unresolved critical findings block approval' using errcode = '23514';
  end if;

  resulting_status := case
    when requested_decision = 'deferred' then 'changes_requested'
    else requested_decision
  end;
  if not public.is_legal_assessment_transition(
    assessment_record.status,
    resulting_status
  ) then
    raise exception 'illegal assessment decision transition' using errcode = '22023';
  end if;

  insert into public.approval_decisions (
    assessment_id,
    buyer_organization_id,
    decision,
    effective_from,
    valid_until,
    conditions,
    internal_rationale,
    decided_by
  ) values (
    assessment_record.id,
    relationship_record.buyer_organization_id,
    requested_decision,
    requested_effective_from,
    requested_valid_until,
    nullif(trim(supplier_conditions), ''),
    trim(buyer_internal_rationale),
    auth.uid()
  )
  returning * into decision_record;

  update public.assessments
  set status = resulting_status, decided_at = case
    when requested_decision = 'deferred' then null
    else now()
  end
  where id = assessment_record.id;

  update public.supplier_relationships
  set onboarding_status = case requested_decision
    when 'approved' then 'qualified'
    when 'conditionally_approved' then 'conditionally_qualified'
    when 'rejected' then 'rejected'
    else onboarding_status
  end
  where id = relationship_record.id;

  update public.review_tasks
  set status = 'completed', completed_at = now()
  where assessment_id = assessment_record.id
    and status in ('pending', 'in_progress');

  insert into public.notifications (
    organization_id, related_resource_type, related_resource_id,
    notification_type, title, body
  ) values (
    relationship_record.supplier_organization_id,
    'decision',
    decision_record.id,
    'assessment.decision_recorded',
    'Qualification decision recorded',
    case requested_decision
      when 'approved' then 'The supplier assessment was approved.'
      when 'conditionally_approved' then 'The supplier assessment was conditionally approved.'
      when 'rejected' then 'The supplier assessment was not approved.'
      else 'The supplier assessment decision was deferred.'
    end
  );

  perform pgmq.send(
    'report_generation',
    jsonb_build_object(
      'assessment_id', assessment_record.id,
      'decision_id', decision_record.id,
      'correlation_id', correlation
    )
  );

  perform public.record_audit_event(
    relationship_record.buyer_organization_id,
    relationship_record.id,
    relationship_record.buyer_organization_id,
    'assessment.decision_recorded',
    'approval_decision',
    decision_record.id,
    jsonb_build_object('assessment_status', assessment_record.status),
    jsonb_build_object(
      'decision', requested_decision,
      'assessment_status', resulting_status
    ),
    correlation
  );
  return decision_record;
end;
$$;

drop trigger risk_evaluations_append_only on public.risk_evaluations;

create or replace function public.protect_risk_evaluation_history()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'risk_evaluations is append-only' using errcode = '55000';
  end if;
  if not (
    old.superseded_at is null
    and new.superseded_at is not null
    and (to_jsonb(new) - 'superseded_at') = (to_jsonb(old) - 'superseded_at')
  ) then
    raise exception 'historical risk evaluations are immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger risk_evaluations_append_only
before update or delete on public.risk_evaluations
for each row execute function public.protect_risk_evaluation_history();

create or replace function public.store_risk_evaluation(
  target_assessment_id uuid,
  calculated_score numeric,
  calculated_level text,
  safe_breakdown jsonb,
  calculator_type text default 'system'
)
returns public.risk_evaluations
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  evaluation_record public.risk_evaluations;
  next_version integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if calculated_level not in ('low', 'medium', 'high', 'critical')
    or calculator_type not in ('system', 'reviewer', 'import') then
    raise exception 'invalid risk evaluation attributes' using errcode = '22023';
  end if;

  perform 1 from public.assessments where id = target_assessment_id for update;
  update public.risk_evaluations
  set superseded_at = now()
  where assessment_id = target_assessment_id
    and superseded_at is null;

  select coalesce(max(calculation_version), 0) + 1
  into next_version
  from public.risk_evaluations
  where assessment_id = target_assessment_id;

  insert into public.risk_evaluations (
    assessment_id, calculation_version, total_score, risk_level,
    scoring_breakdown, calculated_by_type
  ) values (
    target_assessment_id, next_version, calculated_score, calculated_level,
    safe_breakdown, calculator_type
  )
  returning * into evaluation_record;
  return evaluation_record;
end;
$$;

create or replace function public.mark_notification(
  target_notification_id uuid,
  requested_status text
)
returns public.notifications
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  notification_record public.notifications;
begin
  if requested_status not in ('read', 'archived') then
    raise exception 'invalid notification status' using errcode = '22023';
  end if;
  select * into notification_record
  from public.notifications
  where id = target_notification_id
    and public.is_org_member(organization_id)
    and (user_id is null or user_id = auth.uid())
  for update;
  if notification_record.id is null then
    raise exception 'notification not found or inaccessible' using errcode = 'P0002';
  end if;

  update public.notifications
  set
    status = requested_status,
    read_at = case when requested_status = 'read' then now() else read_at end
  where id = target_notification_id
  returning * into notification_record;
  return notification_record;
end;
$$;

create or replace function public.enqueue_compliance_job(
  queue_name text,
  payload jsonb
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, pgmq
as $$
declare
  message_id bigint;
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
  select pgmq.send(queue_name, payload) into message_id;
  return message_id;
end;
$$;

do $$
declare
  function_signature text;
begin
  foreach function_signature in array array[
    'public.create_organization_with_owner(text,text,text,text,text)',
    'public.create_supplier_invitation(uuid,text,text,text,text,timestamp with time zone)',
    'public.accept_supplier_invitation(text,uuid)',
    'public.transition_supplier_relationship(uuid,text,text)',
    'public.publish_program_version(uuid,date)',
    'public.create_assessment(uuid,uuid,uuid,uuid)',
    'public.create_document_version(uuid,uuid,text,text,bigint,text,date,date,text)',
    'public.submit_assessment(uuid,text)',
    'public.start_assessment_review(uuid)',
    'public.request_assessment_changes(uuid,text)',
    'public.record_document_review(uuid,uuid,text,text,text)',
    'public.create_assessment_finding(uuid,text,text,text,text,text,uuid,timestamp with time zone)',
    'public.submit_corrective_action(uuid,text,text,text,date)',
    'public.verify_corrective_action(uuid,text,text)',
    'public.record_approval_decision(uuid,text,date,date,text,text)',
    'public.mark_notification(uuid,text)',
    'public.is_question_visible(uuid,uuid)'
  ]
  loop
    execute format('revoke all on function %s from public, anon', function_signature);
    execute format('grant execute on function %s to authenticated', function_signature);
  end loop;
end;
$$;

revoke all on function public.finalize_document_upload(uuid, text, bigint)
  from public, anon, authenticated;
revoke all on function public.complete_document_processing(uuid, boolean, text)
  from public, anon, authenticated;
revoke all on function public.store_risk_evaluation(uuid, numeric, text, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.enqueue_compliance_job(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.finalize_document_upload(uuid, text, bigint) to service_role;
grant execute on function public.complete_document_processing(uuid, boolean, text) to service_role;
grant execute on function public.store_risk_evaluation(uuid, numeric, text, jsonb, text)
  to service_role;
grant execute on function public.enqueue_compliance_job(text, jsonb) to service_role;

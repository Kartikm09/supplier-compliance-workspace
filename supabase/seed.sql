-- Deterministic fictional portfolio data.
-- Auth rows intentionally have no usable passwords. A separate environment-
-- controlled setup process must make demo accounts login-capable.

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0',
    'authenticated',
    'authenticated',
    'owner@apex-components.invalid',
    null,
    '2026-07-01T08:00:00Z',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Amara Apex"}'::jsonb,
    '2026-07-01T08:00:00Z',
    '2026-07-01T08:00:00Z',
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'authenticated',
    'authenticated',
    'admin@apex-components.invalid',
    null,
    '2026-07-01T08:01:00Z',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Bela Apex"}'::jsonb,
    '2026-07-01T08:01:00Z',
    '2026-07-01T08:01:00Z',
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    'authenticated',
    'authenticated',
    'reviewer@apex-components.invalid',
    null,
    '2026-07-01T08:02:00Z',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Rina Reviewer"}'::jsonb,
    '2026-07-01T08:02:00Z',
    '2026-07-01T08:02:00Z',
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    'authenticated',
    'authenticated',
    'viewer@apex-components.invalid',
    null,
    '2026-07-01T08:03:00Z',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Vik Viewer"}'::jsonb,
    '2026-07-01T08:03:00Z',
    '2026-07-01T08:03:00Z',
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb0',
    'authenticated',
    'authenticated',
    'owner@nova-plastics.invalid',
    null,
    '2026-07-01T08:04:00Z',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Nora Nova"}'::jsonb,
    '2026-07-01T08:04:00Z',
    '2026-07-01T08:04:00Z',
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'authenticated',
    'authenticated',
    'contributor@nova-plastics.invalid',
    null,
    '2026-07-01T08:05:00Z',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Casey Contributor"}'::jsonb,
    '2026-07-01T08:05:00Z',
    '2026-07-01T08:05:00Z',
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'authenticated',
    'authenticated',
    'viewer@nova-plastics.invalid',
    null,
    '2026-07-01T08:06:00Z',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Sam Supplier"}'::jsonb,
    '2026-07-01T08:06:00Z',
    '2026-07-01T08:06:00Z',
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc0',
    'authenticated',
    'authenticated',
    'owner@greenline-packaging.invalid',
    null,
    '2026-07-01T08:07:00Z',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Gia Greenline"}'::jsonb,
    '2026-07-01T08:07:00Z',
    '2026-07-01T08:07:00Z',
    '',
    '',
    '',
    ''
  )
on conflict (id) do nothing;

update public.profiles
set job_title = case id
  when 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0' then 'Procurement Director'
  when 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' then 'Supplier Operations Manager'
  when 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2' then 'Compliance Reviewer'
  when 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3' then 'Procurement Analyst'
  when 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb0' then 'Supplier Director'
  when 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1' then 'Quality Coordinator'
  when 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2' then 'Supplier Observer'
  when 'cccccccc-cccc-4ccc-8ccc-ccccccccccc0' then 'Operations Director'
  else job_title
end
where id in (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb0',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc0'
);

insert into public.organizations (
  id, organization_type, legal_name, display_name, slug, country_code, status, created_by,
  created_at, updated_at
) values
  (
    '11111111-1111-4111-8111-111111111111',
    'buyer',
    'Apex Components Group Demonstration GmbH',
    'Apex Components Group',
    'apex-components-group',
    'DE',
    'active',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0',
    '2026-07-01T09:00:00Z',
    '2026-07-01T09:00:00Z'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'supplier',
    'Nova Plastics Demonstration Ltd.',
    'Nova Plastics Ltd.',
    'nova-plastics',
    'DE',
    'active',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb0',
    '2026-07-01T09:01:00Z',
    '2026-07-01T09:01:00Z'
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'supplier',
    'Greenline Packaging Demonstration Works Ltd.',
    'Greenline Packaging Works',
    'greenline-packaging',
    'NL',
    'active',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc0',
    '2026-07-01T09:02:00Z',
    '2026-07-01T09:02:00Z'
  )
on conflict (id) do nothing;

insert into public.organization_members (
  id, organization_id, user_id, role, membership_status, invited_by, joined_at, created_at
) values
  (
    '10000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0',
    'buyer_owner',
    'active',
    null,
    '2026-07-01T09:00:00Z',
    '2026-07-01T09:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'buyer_admin',
    'active',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0',
    '2026-07-01T09:05:00Z',
    '2026-07-01T09:05:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    'buyer_reviewer',
    'active',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    '2026-07-01T09:06:00Z',
    '2026-07-01T09:06:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    'buyer_viewer',
    'active',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    '2026-07-01T09:07:00Z',
    '2026-07-01T09:07:00Z'
  ),
  (
    '20000000-0000-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb0',
    'supplier_owner',
    'active',
    null,
    '2026-07-01T09:10:00Z',
    '2026-07-01T09:10:00Z'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'supplier_contributor',
    'active',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb0',
    '2026-07-01T09:11:00Z',
    '2026-07-01T09:11:00Z'
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'supplier_viewer',
    'active',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb0',
    '2026-07-01T09:12:00Z',
    '2026-07-01T09:12:00Z'
  ),
  (
    '30000000-0000-4000-8000-000000000001',
    '33333333-3333-4333-8333-333333333333',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc0',
    'supplier_owner',
    'active',
    null,
    '2026-07-01T09:15:00Z',
    '2026-07-01T09:15:00Z'
  )
on conflict (organization_id, user_id) do nothing;

insert into public.supplier_profiles (
  id, supplier_organization_id, registration_number, tax_identifier, website,
  headquarters_country, employee_range, primary_categories, profile_status,
  created_at, updated_at
) values
  (
    '21000000-0000-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222222',
    'DEMO-REG-NOVA-001',
    'DEMO-TAX-XXXX-42',
    'https://nova-plastics.invalid',
    'DE',
    '51-250',
    '["injection-moulding","recycled-polymers"]'::jsonb,
    'verified',
    '2026-07-01T09:20:00Z',
    '2026-07-12T11:00:00Z'
  ),
  (
    '31000000-0000-4000-8000-000000000001',
    '33333333-3333-4333-8333-333333333333',
    'DEMO-REG-GREEN-001',
    'DEMO-TAX-XXXX-73',
    'https://greenline-packaging.invalid',
    'NL',
    '11-50',
    '["packaging","paper-products"]'::jsonb,
    'complete',
    '2026-07-01T09:21:00Z',
    '2026-07-10T10:00:00Z'
  )
on conflict (supplier_organization_id) do nothing;

insert into public.supplier_invitations (
  id, buyer_organization_id, intended_supplier_name, invited_email,
  invitation_token_hash, token_prefix, status, expires_at, accepted_by_user_id,
  resulting_supplier_organization_id, created_by, created_at, accepted_at
) values (
  '41000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'Nova Plastics Ltd.',
  'owner@nova-plastics.invalid',
  '1111111111111111111111111111111111111111111111111111111111111111',
  'NOVADEMO',
  'accepted',
  '2026-07-15T10:00:00Z',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb0',
  '22222222-2222-4222-8222-222222222222',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  '2026-07-01T10:00:00Z',
  '2026-07-02T10:00:00Z'
) on conflict (id) do nothing;

insert into public.supplier_relationships (
  id, buyer_organization_id, supplier_organization_id, buyer_supplier_code,
  relationship_status, onboarding_status, risk_tier, buyer_owner_user_id,
  supplier_owner_user_id, invited_at, accepted_at, created_at, updated_at
) values
  (
    '40000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    'SUP-NOVA-001',
    'active',
    'conditionally_qualified',
    'medium',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb0',
    '2026-07-01T10:00:00Z',
    '2026-07-02T10:00:00Z',
    '2026-07-01T10:00:00Z',
    '2026-07-18T14:00:00Z'
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',
    'SUP-GREEN-001',
    'active',
    'qualification_pending',
    null,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc0',
    '2026-07-03T10:00:00Z',
    '2026-07-04T10:00:00Z',
    '2026-07-03T10:00:00Z',
    '2026-07-04T10:00:00Z'
  )
on conflict (id) do nothing;

insert into public.qualification_programs (
  id, buyer_organization_id, name, description, category, status,
  current_version_id, created_by, created_at, updated_at
) values (
  '50000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'Standard Supplier Qualification',
  'Fictional baseline qualification for component and packaging suppliers.',
  'general-supplier',
  'draft',
  null,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  '2026-07-02T09:00:00Z',
  '2026-07-02T09:00:00Z'
) on conflict (id) do nothing;

insert into public.program_versions (
  id, qualification_program_id, version_number, status, effective_from,
  change_summary, published_by, published_at, created_at
) values (
  '51000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  1,
  'draft',
  null,
  'Initial fictional portfolio version.',
  null,
  null,
  '2026-07-02T09:10:00Z'
) on conflict (id) do nothing;

insert into public.questionnaire_sections (
  id, program_version_id, title, description, display_order
) values
  ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 'Company information', 'Basic organization details.', 10),
  ('52000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000001', 'Quality management', 'Quality controls and certification.', 20),
  ('52000000-0000-4000-8000-000000000003', '51000000-0000-4000-8000-000000000001', 'Delivery capability', 'Delivery planning and resilience.', 30),
  ('52000000-0000-4000-8000-000000000004', '51000000-0000-4000-8000-000000000001', 'Information security', 'Security controls for shared information.', 40),
  ('52000000-0000-4000-8000-000000000005', '51000000-0000-4000-8000-000000000001', 'Environmental practices', 'Environmental management practices.', 50),
  ('52000000-0000-4000-8000-000000000006', '51000000-0000-4000-8000-000000000001', 'Business continuity', 'Continuity and recovery readiness.', 60)
on conflict (id) do nothing;

insert into public.questions (
  id, program_version_id, section_id, stable_question_key, prompt, help_text,
  answer_type, required, display_order, validation_rules,
  conditional_visibility_rules, risk_weight
) values
  (
    '53000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000001',
    '52000000-0000-4000-8000-000000000001',
    'company_summary',
    'Provide a short fictional company summary.',
    'Do not include private customer information.',
    'long_text',
    true,
    10,
    '{"min_length":20,"max_length":500}'::jsonb,
    '{}'::jsonb,
    0
  ),
  (
    '53000000-0000-4000-8000-000000000002',
    '51000000-0000-4000-8000-000000000001',
    '52000000-0000-4000-8000-000000000002',
    'quality_system',
    'Is a documented quality-management system maintained?',
    '',
    'boolean',
    true,
    10,
    '{}'::jsonb,
    '{}'::jsonb,
    25
  ),
  (
    '53000000-0000-4000-8000-000000000003',
    '51000000-0000-4000-8000-000000000001',
    '52000000-0000-4000-8000-000000000003',
    'on_time_delivery',
    'What fictional on-time delivery percentage was achieved last quarter?',
    '',
    'number',
    true,
    10,
    '{"minimum":0,"maximum":100}'::jsonb,
    '{}'::jsonb,
    15
  ),
  (
    '53000000-0000-4000-8000-000000000004',
    '51000000-0000-4000-8000-000000000001',
    '52000000-0000-4000-8000-000000000004',
    'security_review_frequency',
    'How often are information-security controls reviewed?',
    '',
    'single_select',
    true,
    10,
    '{}'::jsonb,
    '{}'::jsonb,
    20
  ),
  (
    '53000000-0000-4000-8000-000000000005',
    '51000000-0000-4000-8000-000000000001',
    '52000000-0000-4000-8000-000000000005',
    'environmental_practices',
    'Select the fictional environmental practices in place.',
    '',
    'multi_select',
    false,
    10,
    '{}'::jsonb,
    '{}'::jsonb,
    10
  ),
  (
    '53000000-0000-4000-8000-000000000006',
    '51000000-0000-4000-8000-000000000001',
    '52000000-0000-4000-8000-000000000006',
    'continuity_test_date',
    'When was the continuity plan most recently tested?',
    '',
    'date',
    true,
    10,
    '{}'::jsonb,
    '{}'::jsonb,
    20
  )
on conflict (id) do nothing;

insert into public.question_options (
  id, question_id, value, label, display_order, risk_score
) values
  ('54000000-0000-4000-8000-000000000001', '53000000-0000-4000-8000-000000000004', 'quarterly', 'Quarterly', 10, 0),
  ('54000000-0000-4000-8000-000000000002', '53000000-0000-4000-8000-000000000004', 'annually', 'Annually', 20, 5),
  ('54000000-0000-4000-8000-000000000003', '53000000-0000-4000-8000-000000000004', 'ad_hoc', 'Ad hoc', 30, 15),
  ('54000000-0000-4000-8000-000000000004', '53000000-0000-4000-8000-000000000005', 'waste_tracking', 'Waste tracking', 10, 0),
  ('54000000-0000-4000-8000-000000000005', '53000000-0000-4000-8000-000000000005', 'recycled_materials', 'Recycled materials', 20, 0),
  ('54000000-0000-4000-8000-000000000006', '53000000-0000-4000-8000-000000000005', 'energy_monitoring', 'Energy monitoring', 30, 0)
on conflict (id) do nothing;

insert into public.document_requirements (
  id, program_version_id, stable_requirement_key, name, description, required,
  accepted_mime_types, maximum_size_bytes, requires_issue_date,
  requires_expiry_date, minimum_validity_days, display_order
) values
  (
    '55000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000001',
    'business_registration',
    'Fictional business registration',
    'Demonstration-only registration evidence.',
    true,
    array['application/pdf'],
    5242880,
    true,
    false,
    0,
    10
  ),
  (
    '55000000-0000-4000-8000-000000000002',
    '51000000-0000-4000-8000-000000000001',
    'quality_certificate',
    'Fictional quality certificate',
    'Demonstration-only quality certificate.',
    true,
    array['application/pdf'],
    5242880,
    true,
    true,
    0,
    20
  ),
  (
    '55000000-0000-4000-8000-000000000003',
    '51000000-0000-4000-8000-000000000001',
    'insurance_confirmation',
    'Fictional insurance confirmation',
    'Demonstration-only insurance evidence.',
    true,
    array['application/pdf'],
    5242880,
    true,
    true,
    0,
    30
  ),
  (
    '55000000-0000-4000-8000-000000000004',
    '51000000-0000-4000-8000-000000000001',
    'environmental_policy',
    'Fictional environmental policy',
    'Demonstration-only policy document.',
    true,
    array['application/pdf', 'text/plain'],
    5242880,
    false,
    false,
    0,
    40
  )
on conflict (id) do nothing;

update public.program_versions
set
  status = 'active',
  effective_from = '2026-07-03',
  published_by = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  published_at = '2026-07-03T09:00:00Z'
where id = '51000000-0000-4000-8000-000000000001'
  and status = 'draft';

update public.qualification_programs
set
  status = 'active',
  current_version_id = '51000000-0000-4000-8000-000000000001',
  updated_at = '2026-07-03T09:00:00Z'
where id = '50000000-0000-4000-8000-000000000001';

insert into public.assessments (
  id, supplier_relationship_id, qualification_program_id, program_version_id,
  status, assigned_supplier_user_id, assigned_buyer_reviewer_id, started_at,
  completeness_percentage, created_at, updated_at
) values (
  '60000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  '51000000-0000-4000-8000-000000000001',
  'in_progress',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  '2026-07-05T09:00:00Z',
  0,
  '2026-07-05T09:00:00Z',
  '2026-07-05T09:00:00Z'
) on conflict (id) do nothing;

insert into public.assessment_responses (
  id, assessment_id, question_id, response_text, response_number,
  response_boolean, response_date, response_option_id, response_json,
  answered_by, answered_at, updated_at
) values
  (
    '61000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '53000000-0000-4000-8000-000000000001',
    'Nova Plastics is a fictional supplier used only for portfolio demonstration.',
    null, null, null, null, null,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    '2026-07-07T09:00:00Z',
    '2026-07-07T09:00:00Z'
  ),
  (
    '61000000-0000-4000-8000-000000000002',
    '60000000-0000-4000-8000-000000000001',
    '53000000-0000-4000-8000-000000000002',
    null, null, true, null, null, null,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    '2026-07-07T09:02:00Z',
    '2026-07-07T09:02:00Z'
  ),
  (
    '61000000-0000-4000-8000-000000000003',
    '60000000-0000-4000-8000-000000000001',
    '53000000-0000-4000-8000-000000000003',
    null, 96.4, null, null, null, null,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    '2026-07-07T09:04:00Z',
    '2026-07-07T09:04:00Z'
  ),
  (
    '61000000-0000-4000-8000-000000000004',
    '60000000-0000-4000-8000-000000000001',
    '53000000-0000-4000-8000-000000000004',
    null, null, null, null,
    '54000000-0000-4000-8000-000000000002',
    null,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    '2026-07-07T09:06:00Z',
    '2026-07-07T09:06:00Z'
  ),
  (
    '61000000-0000-4000-8000-000000000005',
    '60000000-0000-4000-8000-000000000001',
    '53000000-0000-4000-8000-000000000005',
    null, null, null, null, null,
    '["waste_tracking","recycled_materials"]'::jsonb,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    '2026-07-07T09:08:00Z',
    '2026-07-07T09:08:00Z'
  ),
  (
    '61000000-0000-4000-8000-000000000006',
    '60000000-0000-4000-8000-000000000001',
    '53000000-0000-4000-8000-000000000006',
    null, null, null, '2026-05-10', null, null,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    '2026-07-07T09:10:00Z',
    '2026-07-07T09:10:00Z'
  )
on conflict (id) do nothing;

insert into public.documents (
  id, supplier_relationship_id, supplier_organization_id,
  document_requirement_id, document_type, current_version_id, status,
  created_by, created_at, updated_at
) values
  (
    '70000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222222',
    '55000000-0000-4000-8000-000000000001',
    'business_registration',
    null,
    'submitted',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    '2026-07-08T09:00:00Z',
    '2026-07-08T09:00:00Z'
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222222',
    '55000000-0000-4000-8000-000000000002',
    'quality_certificate',
    null,
    'submitted',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    '2026-07-08T09:01:00Z',
    '2026-07-08T09:01:00Z'
  ),
  (
    '70000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222222',
    '55000000-0000-4000-8000-000000000003',
    'insurance_confirmation',
    null,
    'submitted',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    '2026-07-08T09:02:00Z',
    '2026-07-08T09:02:00Z'
  ),
  (
    '70000000-0000-4000-8000-000000000004',
    '40000000-0000-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222222',
    '55000000-0000-4000-8000-000000000004',
    'environmental_policy',
    null,
    'submitted',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    '2026-07-08T09:03:00Z',
    '2026-07-08T09:03:00Z'
  )
on conflict (id) do nothing;

insert into public.document_versions (
  id, document_id, version_number, storage_path, original_filename,
  sanitized_filename, mime_type, byte_size, sha256_hash, issue_date,
  expiry_date, issuing_body, upload_status, processing_status,
  processing_error, uploaded_by, uploaded_at, superseded_at, created_at
) values
  (
    '71000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000001',
    1,
    '11111111-1111-4111-8111-111111111111/40000000-0000-4000-8000-000000000001/70000000-0000-4000-8000-000000000001/1/business-registration-demo.pdf',
    'business-registration-demo.pdf',
    'business-registration-demo.pdf',
    'application/pdf',
    2048,
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '2026-01-15',
    null,
    'Fictional Registry Office',
    'ready',
    'complete',
    null,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    '2026-07-08T10:00:00Z',
    null,
    '2026-07-08T09:50:00Z'
  ),
  (
    '71000000-0000-4000-8000-000000000002',
    '70000000-0000-4000-8000-000000000002',
    1,
    '11111111-1111-4111-8111-111111111111/40000000-0000-4000-8000-000000000001/70000000-0000-4000-8000-000000000002/1/quality-certificate-old-demo.pdf',
    'quality-certificate-old-demo.pdf',
    'quality-certificate-old-demo.pdf',
    'application/pdf',
    3072,
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    '2025-08-15',
    '2026-08-15',
    'Fictional Quality Institute',
    'superseded',
    'complete',
    null,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    '2026-07-08T10:05:00Z',
    '2026-07-12T10:00:00Z',
    '2026-07-08T09:55:00Z'
  ),
  (
    '71000000-0000-4000-8000-000000000003',
    '70000000-0000-4000-8000-000000000002',
    2,
    '11111111-1111-4111-8111-111111111111/40000000-0000-4000-8000-000000000001/70000000-0000-4000-8000-000000000002/2/quality-certificate-replacement-demo.pdf',
    'quality-certificate-replacement-demo.pdf',
    'quality-certificate-replacement-demo.pdf',
    'application/pdf',
    3200,
    'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    '2026-07-10',
    '2027-07-10',
    'Fictional Quality Institute',
    'ready',
    'complete',
    null,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    '2026-07-12T10:00:00Z',
    null,
    '2026-07-12T09:50:00Z'
  ),
  (
    '71000000-0000-4000-8000-000000000004',
    '70000000-0000-4000-8000-000000000003',
    1,
    '11111111-1111-4111-8111-111111111111/40000000-0000-4000-8000-000000000001/70000000-0000-4000-8000-000000000003/1/insurance-confirmation-demo.pdf',
    'insurance-confirmation-demo.pdf',
    'insurance-confirmation-demo.pdf',
    'application/pdf',
    2300,
    'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    '2026-01-01',
    '2026-08-15',
    'Fictional Mutual Insurance',
    'ready',
    'complete',
    null,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    '2026-07-08T10:10:00Z',
    null,
    '2026-07-08T10:00:00Z'
  ),
  (
    '71000000-0000-4000-8000-000000000005',
    '70000000-0000-4000-8000-000000000004',
    1,
    '11111111-1111-4111-8111-111111111111/40000000-0000-4000-8000-000000000001/70000000-0000-4000-8000-000000000004/1/environmental-policy-demo.txt',
    'environmental-policy-demo.txt',
    'environmental-policy-demo.txt',
    'text/plain',
    1200,
    'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    null,
    null,
    'Nova Plastics Demonstration',
    'ready',
    'complete',
    null,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    '2026-07-08T10:15:00Z',
    null,
    '2026-07-08T10:05:00Z'
  )
on conflict (id) do nothing;

update public.documents
set
  current_version_id = case id
    when '70000000-0000-4000-8000-000000000001' then '71000000-0000-4000-8000-000000000001'::uuid
    when '70000000-0000-4000-8000-000000000002' then '71000000-0000-4000-8000-000000000003'::uuid
    when '70000000-0000-4000-8000-000000000003' then '71000000-0000-4000-8000-000000000004'::uuid
    when '70000000-0000-4000-8000-000000000004' then '71000000-0000-4000-8000-000000000005'::uuid
  end,
  status = 'accepted',
  updated_at = '2026-07-15T10:00:00Z'
where id in (
  '70000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000002',
  '70000000-0000-4000-8000-000000000003',
  '70000000-0000-4000-8000-000000000004'
);

insert into public.assessment_submission_snapshots (
  id, assessment_id, submission_number, submitted_by, responses_snapshot,
  documents_snapshot, declaration, completeness_percentage, submitted_at
) values (
  '62000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  1,
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb0',
  (
    select jsonb_agg(
      jsonb_build_object('question_id', question_id, 'answer_record_id', id)
      order by question_id
    )
    from public.assessment_responses
    where assessment_id = '60000000-0000-4000-8000-000000000001'
  ),
  (
    select jsonb_agg(
      jsonb_build_object(
        'document_id', document.id,
        'document_version_id', document.current_version_id
      )
      order by document.id
    )
    from public.documents document
    where document.supplier_relationship_id = '40000000-0000-4000-8000-000000000001'
  ),
  'I confirm that this demonstration submission contains fictional portfolio-safe information.',
  100,
  '2026-07-10T11:00:00Z'
) on conflict (id) do nothing;

insert into public.document_reviews (
  id, assessment_id, document_version_id, reviewer_user_id, status,
  reviewer_note, internal_note, reviewed_at, created_at
) values
  (
    '72000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000002',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    'replacement_requested',
    'Please upload the renewed fictional certificate.',
    'Internal demo note: verify the replacement date range.',
    '2026-07-11T09:00:00Z',
    '2026-07-11T09:00:00Z'
  ),
  (
    '72000000-0000-4000-8000-000000000002',
    '60000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000003',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    'accepted',
    'Replacement accepted for this fictional review.',
    'Internal demo note: replacement metadata is consistent.',
    '2026-07-13T09:00:00Z',
    '2026-07-13T09:00:00Z'
  )
on conflict (id) do nothing;

insert into public.review_tasks (
  id, assessment_id, buyer_organization_id, assigned_to, task_type,
  status, due_at, completed_at, created_at
) values (
  '73000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  'initial_review',
  'completed',
  '2026-07-17T17:00:00Z',
  '2026-07-18T13:00:00Z',
  '2026-07-10T11:01:00Z'
) on conflict (id) do nothing;

insert into public.findings (
  id, assessment_id, buyer_organization_id, supplier_relationship_id,
  finding_number, severity, category, title, description, status,
  internal_note, raised_by, assigned_supplier_user_id, due_at, raised_at, closed_at
) values (
  '80000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  '40000000-0000-4000-8000-000000000001',
  1,
  'medium',
  'business-continuity',
  'Continuity test evidence needs clarification',
  'Describe how the fictional continuity test result was reviewed.',
  'verified',
  'Buyer-only demonstration note: monitor this item at renewal.',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  '2026-07-18T17:00:00Z',
  '2026-07-14T09:00:00Z',
  null
) on conflict (id) do nothing;

insert into public.finding_events (
  id, finding_id, organization_id, actor_user_id, event_type,
  supplier_visible, comment, metadata, created_at
) values
  (
    '81000000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    'finding.created',
    true,
    'Clarification requested for fictional evidence.',
    '{}'::jsonb,
    '2026-07-14T09:00:00Z'
  ),
  (
    '81000000-0000-4000-8000-000000000002',
    '80000000-0000-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'corrective_action.submitted',
    true,
    'Fictional corrective action submitted.',
    '{}'::jsonb,
    '2026-07-16T09:00:00Z'
  ),
  (
    '81000000-0000-4000-8000-000000000003',
    '80000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    'corrective_action.accepted',
    true,
    'The fictional response is sufficient.',
    '{}'::jsonb,
    '2026-07-17T09:00:00Z'
  )
on conflict (id) do nothing;

insert into public.corrective_actions (
  id, finding_id, supplier_organization_id, submitted_by, root_cause,
  correction, preventive_action, target_completion_date, status,
  submitted_at, verified_by, verified_at, verification_note, created_at, updated_at
) values (
  '82000000-0000-4000-8000-000000000001',
  '80000000-0000-4000-8000-000000000001',
  '22222222-2222-4222-8222-222222222222',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  'The fictional test summary omitted the approval record.',
  'The demonstration summary was updated with an approval reference.',
  'A checklist item was added for future fictional continuity exercises.',
  '2026-07-20',
  'accepted',
  '2026-07-16T09:00:00Z',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  '2026-07-17T09:00:00Z',
  'The fictional corrective action is sufficient.',
  '2026-07-16T09:00:00Z',
  '2026-07-17T09:00:00Z'
) on conflict (id) do nothing;

insert into public.risk_evaluations (
  id, assessment_id, calculation_version, total_score, risk_level,
  scoring_breakdown, calculated_at, calculated_by_type, superseded_at
) values (
  '83000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  1,
  28.5,
  'medium',
  '{"quality":5,"delivery":3.5,"security":5,"continuity":15}'::jsonb,
  '2026-07-17T10:00:00Z',
  'system',
  null
) on conflict (id) do nothing;

insert into public.approval_decisions (
  id, assessment_id, buyer_organization_id, decision, effective_from,
  valid_until, conditions, internal_rationale, decided_by, decided_at, created_at
) values (
  '84000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'conditionally_approved',
  '2026-07-18',
  '2027-07-17',
  'Provide an updated fictional insurance confirmation before expiry.',
  'Buyer-only demonstration rationale: medium residual continuity risk remains.',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0',
  '2026-07-18T13:00:00Z',
  '2026-07-18T13:00:00Z'
) on conflict (id) do nothing;

update public.assessments
set
  status = 'conditionally_approved',
  submitted_at = '2026-07-10T11:00:00Z',
  review_started_at = '2026-07-10T13:00:00Z',
  decided_at = '2026-07-18T13:00:00Z',
  completeness_percentage = 100,
  supplier_declaration = 'I confirm that this demonstration submission contains fictional portfolio-safe information.',
  updated_at = '2026-07-18T13:00:00Z'
where id = '60000000-0000-4000-8000-000000000001';

insert into public.notifications (
  id, organization_id, user_id, related_resource_type, related_resource_id,
  notification_type, title, body, status, read_at, created_at
) values
  (
    '90000000-0000-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb0',
    'document',
    '70000000-0000-4000-8000-000000000003',
    'document.expiring',
    'Fictional insurance document expires soon',
    'Upload a replacement demonstration document before its fictional expiry.',
    'unread',
    null,
    '2026-07-20T06:15:00Z'
  ),
  (
    '90000000-0000-4000-8000-000000000002',
    '22222222-2222-4222-8222-222222222222',
    null,
    'decision',
    '84000000-0000-4000-8000-000000000001',
    'assessment.decision_recorded',
    'Conditional qualification recorded',
    'Apex recorded a fictional conditional qualification decision.',
    'read',
    '2026-07-18T14:00:00Z',
    '2026-07-18T13:01:00Z'
  )
on conflict (id) do nothing;

insert into public.audit_events (
  id, organization_id, relationship_id, actor_user_id, actor_organization_id,
  action, resource_type, resource_id, old_values, new_values,
  correlation_id, created_at
) values
  (
    '91000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    '40000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    '11111111-1111-4111-8111-111111111111',
    'supplier_invitation.created',
    'supplier_invitation',
    '41000000-0000-4000-8000-000000000001',
    '{}'::jsonb,
    '{"intended_supplier_name":"Nova Plastics Ltd."}'::jsonb,
    '92000000-0000-4000-8000-000000000001',
    '2026-07-01T10:00:00Z'
  ),
  (
    '91000000-0000-4000-8000-000000000002',
    '11111111-1111-4111-8111-111111111111',
    '40000000-0000-4000-8000-000000000001',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb0',
    '22222222-2222-4222-8222-222222222222',
    'supplier_relationship.activated',
    'supplier_relationship',
    '40000000-0000-4000-8000-000000000001',
    '{"status":"invited"}'::jsonb,
    '{"status":"active"}'::jsonb,
    '92000000-0000-4000-8000-000000000002',
    '2026-07-02T10:00:00Z'
  ),
  (
    '91000000-0000-4000-8000-000000000003',
    '11111111-1111-4111-8111-111111111111',
    '40000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0',
    '11111111-1111-4111-8111-111111111111',
    'assessment.decision_recorded',
    'approval_decision',
    '84000000-0000-4000-8000-000000000001',
    '{"status":"under_review"}'::jsonb,
    '{"status":"conditionally_approved","decision":"conditionally_approved"}'::jsonb,
    '92000000-0000-4000-8000-000000000003',
    '2026-07-18T13:00:00Z'
  ),
  (
    '91000000-0000-4000-8000-000000000004',
    '22222222-2222-4222-8222-222222222222',
    '40000000-0000-4000-8000-000000000001',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb0',
    '22222222-2222-4222-8222-222222222222',
    'assessment.decision_received',
    'assessment',
    '60000000-0000-4000-8000-000000000001',
    '{"status":"under_review"}'::jsonb,
    '{"status":"conditionally_approved"}'::jsonb,
    '92000000-0000-4000-8000-000000000003',
    '2026-07-18T13:00:00Z'
  )
on conflict (id) do nothing;

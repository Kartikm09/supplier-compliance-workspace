begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

select has_function(
  'public',
  'accept_supplier_invitation_with_setup',
  array['text', 'text', 'uuid', 'text', 'text', 'text', 'text', 'uuid'],
  'invitation acceptance supports existing or newly created suppliers'
);
select has_function(
  'public',
  'transition_assessment',
  array['uuid', 'text', 'text'],
  'browser assessment transition contract exists'
);
select has_function(
  'public',
  'mark_notification_read',
  array['uuid'],
  'browser notification contract exists'
);
select has_function(
  'public',
  'request_assessment_report',
  array['uuid', 'uuid'],
  'report queue contract exists'
);
select has_function(
  'public',
  'process_notification_job',
  array['uuid', 'uuid'],
  'notification worker contract exists'
);

select function_privs_are(
  'public',
  'transition_assessment',
  array['uuid', 'text', 'text'],
  'authenticated',
  array['EXECUTE'],
  'authenticated users may call the controlled assessment transition'
);
select function_privs_are(
  'public',
  'transition_assessment',
  array['uuid', 'text', 'text'],
  'anon',
  array[]::text[],
  'anonymous users cannot transition assessments'
);
select function_privs_are(
  'public',
  'request_assessment_report',
  array['uuid', 'uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated reviewers may request reports'
);
select function_privs_are(
  'public',
  'process_notification_job',
  array['uuid', 'uuid'],
  'service_role',
  array['EXECUTE'],
  'the service role may validate queued notifications'
);
select function_privs_are(
  'public',
  'process_notification_job',
  array['uuid', 'uuid'],
  'authenticated',
  array[]::text[],
  'normal users cannot forge notification delivery'
);
select function_privs_are(
  'public',
  'accept_supplier_invitation_with_setup',
  array['text', 'text', 'uuid', 'text', 'text', 'text', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous users cannot accept supplier invitations'
);
select function_privs_are(
  'public',
  'mark_notification_read',
  array['uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated recipients may mark accessible notifications'
);
select has_table(
  'public',
  'generated_assessment_reports',
  'generated reports have durable private metadata'
);
select is(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.generated_assessment_reports'::regclass
  ),
  true,
  'generated report metadata has RLS enabled'
);
select is(
  (
    select relforcerowsecurity
    from pg_class
    where oid = 'public.generated_assessment_reports'::regclass
  ),
  true,
  'generated report metadata forces RLS'
);
select table_privs_are(
  'public',
  'generated_assessment_reports',
  'authenticated',
  array['SELECT'],
  'authenticated users receive read-only report metadata access'
);

select * from finish();
rollback;

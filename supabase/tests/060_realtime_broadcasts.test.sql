begin;

create extension if not exists pgtap with schema extensions;
select plan(5);

select has_function(
  'public',
  'broadcast_compliance_change',
  array[]::text[],
  'private Broadcast trigger function exists'
);

select ok(
  (
    select prosecdef
    from pg_proc
    where oid = 'public.broadcast_compliance_change()'::regprocedure
  ),
  'private Broadcast trigger function is security definer'
);

select ok(
  (
    select proconfig @> array['search_path=pg_catalog, public, realtime']
    from pg_proc
    where oid = 'public.broadcast_compliance_change()'::regprocedure
  ),
  'private Broadcast trigger function pins its search path'
);

select has_trigger(
  'public',
  'assessments',
  'assessments_private_broadcast',
  'assessment changes emit private invalidations'
);

select has_trigger(
  'public',
  'notifications',
  'notifications_private_broadcast',
  'notification changes emit private invalidations'
);

select * from finish();
rollback;

begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

insert into public.finding_events (
  id,
  finding_id,
  organization_id,
  actor_user_id,
  event_type,
  supplier_visible,
  comment,
  metadata,
  created_at
) values (
  '81000000-0000-4000-8000-000000000004',
  '80000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  'review.internal_note',
  false,
  'Buyer-only event used to prove relationship-scoped redaction.',
  '{}'::jsonb,
  '2026-07-17T10:00:00Z'
);

select has_function(
  'public',
  'buyer_can_view_finding',
  array['uuid'],
  'buyer finding visibility helper exists'
);

select ok(
  (
    select prosecdef
    from pg_proc
    where oid = 'public.buyer_can_view_finding(uuid)'::regprocedure
  ),
  'buyer finding visibility helper is security definer'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  (
    select count(*)
    from public.finding_events
    where finding_id = '80000000-0000-4000-8000-000000000001'
  ),
  4::bigint,
  'buyer reviewer sees internal and supplier-visible finding events'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  (
    select count(*)
    from public.finding_events
    where finding_id = '80000000-0000-4000-8000-000000000001'
  ),
  3::bigint,
  'supplier contributor sees only supplier-visible finding events'
);
select is(
  (
    select count(*)
    from public.finding_events
    where id = '81000000-0000-4000-8000-000000000004'
  ),
  0::bigint,
  'supplier contributor cannot read buyer-internal finding events'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc0',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  (select count(*) from public.finding_events),
  0::bigint,
  'unrelated supplier sees no Nova finding events'
);
reset role;

select * from finish();
rollback;

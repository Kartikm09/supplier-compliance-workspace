import { generateInvitationToken, inspectInvitationToken, sha256Hex } from "./crypto.ts";
import { assert, assertEquals, assertRejects } from "./test_support.ts";

Deno.test("invitation tokens are high entropy, inspectable, and stored by hash", async () => {
  const first = await generateInvitationToken();
  const second = await generateInvitationToken();

  assert(first.token.startsWith(`${first.prefix}_`));
  assert(first.token.length >= 48);
  assert(first.token !== second.token);
  assertEquals(first.hash, await sha256Hex(first.token));
  assert(!first.hash.includes(first.token));
  assertEquals(await inspectInvitationToken(first.token), {
    prefix: first.prefix,
    hash: first.hash,
  });
});

Deno.test("malformed invitation tokens are rejected before database lookup", async () => {
  await assertRejects(
    () => inspectInvitationToken("not-a-real-token"),
    "Invalid invitation token format",
  );
});

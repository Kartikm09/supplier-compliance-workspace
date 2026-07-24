import { omitSensitive } from "./rpc.ts";
import { assertEquals } from "./test_support.ts";

Deno.test("RPC responses strip internal and token fields before serialization", () => {
  assertEquals(
    omitSensitive({
      id: "public-id",
      invitation_token_hash: "private",
      token_prefix: "private",
      internal_note: "private",
      internal_rationale: "private",
      status: "active",
    }),
    { id: "public-id", status: "active" },
  );
});

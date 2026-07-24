import { AppError } from "./errors.ts";
import { constantTimeEqual, requireBearerToken, requireInternalToken } from "./security.ts";
import { assert, assertEquals, assertThrows } from "./test_support.ts";

Deno.test("bearer authentication rejects missing and malformed headers", () => {
  const missing = assertThrows(
    () => requireBearerToken(new Request("http://local.test")),
  ) as AppError;
  assertEquals(missing.status, 401);
  assertThrows(
    () =>
      requireBearerToken(
        new Request("http://local.test", { headers: { authorization: "Basic abc" } }),
      ),
  );
  assertEquals(
    requireBearerToken(
      new Request("http://local.test", { headers: { authorization: "Bearer local-jwt" } }),
    ),
    "local-jwt",
  );
});

Deno.test("internal authorization requires a long exact token", () => {
  const expected = "a".repeat(32);
  assertThrows(
    () => requireInternalToken(new Request("http://local.test"), expected),
    "Internal authentication failed",
  );
  assertThrows(
    () =>
      requireInternalToken(
        new Request("http://local.test", {
          headers: { "x-internal-token": `${expected}x` },
        }),
        expected,
      ),
  );
  requireInternalToken(
    new Request("http://local.test", { headers: { "x-internal-token": expected } }),
    expected,
  );
  assert(constantTimeEqual(expected, expected));
  assert(!constantTimeEqual(expected, `${expected}x`));
});

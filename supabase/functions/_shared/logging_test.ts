import { redactLogFields } from "./logging.ts";
import { assertEquals } from "./test_support.ts";

Deno.test("structured log fields redact secrets and unrestricted payloads", () => {
  assertEquals(
    redactLogFields({
      queue: "document_processing",
      invitation_token: "must-not-appear",
      authorization: "Bearer must-not-appear",
      payload: { private: true },
      message_id: 42,
    }),
    {
      queue: "document_processing",
      invitation_token: "[REDACTED]",
      authorization: "[REDACTED]",
      payload: "[REDACTED]",
      message_id: 42,
    },
  );
});

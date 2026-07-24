import { jobMetadata, jobPayload, parseQueueMessage, supplierSafeReportFindings } from "./queue.ts";
import { assertEquals, assertThrows } from "./test_support.ts";

const DOCUMENT_VERSION_ID = "11111111-1111-4111-8111-111111111111";
const CORRELATION_ID = "22222222-2222-4222-8222-222222222222";

Deno.test("queue dispatch allowlists only the required record ID and correlation ID", () => {
  const message = parseQueueMessage({
    msg_id: 7,
    read_ct: 1,
    message: {
      document_version_id: DOCUMENT_VERSION_ID,
      correlation_id: CORRELATION_ID,
      storage_path: "../../private",
      secret: "must-not-forward",
    },
  });
  assertEquals(jobPayload("document_processing", message, crypto.randomUUID()), {
    document_version_id: DOCUMENT_VERSION_ID,
    correlation_id: CORRELATION_ID,
  });
  assertEquals(jobMetadata("document_processing", message, CORRELATION_ID), {
    attempt: 1,
    correlation_id: CORRELATION_ID,
    job_id: `document_processing:7:${DOCUMENT_VERSION_ID}`,
  });
});

Deno.test("malformed queue messages and non-UUID identifiers are rejected", () => {
  assertThrows(() => parseQueueMessage({ msg_id: "7", read_ct: 1, message: {} }));
  const message = parseQueueMessage({
    msg_id: 7,
    read_ct: 5,
    message: { notification_id: "../notification" },
  });
  assertThrows(() => jobPayload("notification_delivery", message, CORRELATION_ID));
});

Deno.test("report finding summaries exclude identifiers and internal notes", () => {
  assertEquals(
    supplierSafeReportFindings([
      {
        id: DOCUMENT_VERSION_ID,
        finding_number: 4,
        severity: "medium",
        title: "Synthetic finding",
        status: "verified",
        internal_note: "buyer only",
      },
    ]),
    [
      {
        finding_number: 4,
        severity: "medium",
        title: "Synthetic finding",
        status: "verified",
      },
    ],
  );
});

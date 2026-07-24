import { sha256Hex } from "./crypto.ts";
import {
  assertEvidenceStoragePath,
  parseDocumentVersionRecord,
  publicStorageUrl,
  verifyDocumentBlob,
} from "./storage.ts";
import { assertEquals, assertRejects, assertThrows } from "./test_support.ts";

const BUYER_ID = "11111111-1111-4111-8111-111111111111";
const RELATIONSHIP_ID = "22222222-2222-4222-8222-222222222222";
const DOCUMENT_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_ID = "44444444-4444-4444-8444-444444444444";
const STORAGE_PATH = `${BUYER_ID}/${RELATIONSHIP_ID}/${DOCUMENT_ID}/1/certificate.pdf`;

Deno.test("evidence paths require the server-generated relationship layout", () => {
  assertEvidenceStoragePath(STORAGE_PATH);
  assertThrows(() => assertEvidenceStoragePath(`${BUYER_ID}/../secret.pdf`));
  assertThrows(() => assertEvidenceStoragePath(`/absolute/${STORAGE_PATH}`));
  assertThrows(
    () => assertEvidenceStoragePath(`${BUYER_ID}/${RELATIONSHIP_ID}/${DOCUMENT_ID}/0/file.pdf`),
  );
});

Deno.test("client-facing signed URLs use the configured public Supabase origin", () => {
  assertEquals(
    publicStorageUrl(
      "http://kong:8000/storage/v1/object/sign/private/file.pdf?token=synthetic",
      "http://127.0.0.1:54321",
    ),
    "http://127.0.0.1:54321/storage/v1/object/sign/private/file.pdf?token=synthetic",
  );
});

Deno.test("document verification checks record shape, size, MIME type, and checksum", async () => {
  const contents = new TextEncoder().encode("fictional evidence document");
  const record = parseDocumentVersionRecord({
    id: VERSION_ID,
    storage_path: STORAGE_PATH,
    original_filename: "certificate.pdf",
    mime_type: "application/pdf",
    byte_size: contents.byteLength,
    sha256_hash: await sha256Hex(contents),
    upload_status: "pending_upload",
    processing_status: "pending",
  });
  const result = await verifyDocumentBlob(
    new Blob([contents], { type: "application/pdf" }),
    record,
  );
  assertEquals(result.sha256Hash, record.sha256_hash);
  await assertRejects(
    () => verifyDocumentBlob(new Blob(["changed"], { type: "application/pdf" }), record),
    "size does not match",
  );
});

Deno.test("document verification accepts MIME charset parameters but rejects other types", async () => {
  const contents = new TextEncoder().encode("fictional text evidence");
  const record = parseDocumentVersionRecord({
    id: VERSION_ID,
    storage_path: STORAGE_PATH.replace(".pdf", ".txt"),
    original_filename: "policy.txt",
    mime_type: "text/plain",
    byte_size: contents.byteLength,
    sha256_hash: await sha256Hex(contents),
    upload_status: "pending_upload",
    processing_status: "pending",
  });

  await verifyDocumentBlob(
    new Blob([contents], { type: "text/plain; charset=utf-8" }),
    record,
  );
  await assertRejects(
    () => verifyDocumentBlob(new Blob([contents], { type: "application/pdf" }), record),
    "file type does not match",
  );
});

import {
  parseAcceptSupplierInvitation,
  parseCreateDocumentUpload,
  parseCreateFinding,
  parseCreateSupplierInvitation,
  parseFinalizeDocumentUpload,
  parseGetSignedDocumentUrl,
  parseRecordApprovalDecision,
  parseSubmitAssessment,
  parseSubmitCorrectiveAction,
} from "./contracts.ts";
import { assertEquals, assertThrows } from "./test_support.ts";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

Deno.test("supplier invitation input is normalized and bounded", () => {
  assertEquals(
    parseCreateSupplierInvitation({
      buyer_organization_id: UUID_A,
      intended_supplier_name: "  Nova Plastics Ltd.  ",
      invited_email: "SUPPLIER@EXAMPLE.TEST",
    }),
    {
      buyerOrganizationId: UUID_A,
      intendedSupplierName: "Nova Plastics Ltd.",
      invitedEmail: "supplier@example.test",
      expiresInHours: 72,
    },
  );
  assertThrows(
    () =>
      parseCreateSupplierInvitation({
        buyer_organization_id: UUID_A,
        intended_supplier_name: "Nova",
        invited_email: "invalid",
      }),
    "valid email",
  );
});

Deno.test("invitation acceptance requires exactly one supplier selection mode", () => {
  const token = `scwi_abcdefghij_${"x".repeat(33)}`;
  assertEquals(
    parseAcceptSupplierInvitation({
      invitation_token: token,
      supplier_organization_id: UUID_A,
    }).existingSupplierOrganizationId,
    UUID_A,
  );
  assertEquals(
    parseAcceptSupplierInvitation({
      invitation_token: token,
      new_supplier: {
        legal_name: "Nova Plastics Limited",
        display_name: "Nova Plastics",
        slug: "nova-plastics",
        country_code: "in",
      },
    }).newSupplier?.countryCode,
    "IN",
  );
  assertThrows(
    () =>
      parseAcceptSupplierInvitation({
        invitation_token: token,
        supplier_organization_id: UUID_A,
        new_supplier: {
          legal_name: "Nova",
          display_name: "Nova",
          slug: "nova",
          country_code: "IN",
        },
      }),
    "either supplier_organization_id or new_supplier",
  );
});

Deno.test("document reservations enforce size, checksum, MIME, extension, and dates", () => {
  const valid = parseCreateDocumentUpload({
    assessment_id: UUID_A,
    supplier_relationship_id: UUID_A,
    document_requirement_id: UUID_B,
    document_type: "quality_certificate",
    original_filename: "Quality Certificate.pdf",
    mime_type: "application/pdf",
    byte_size: 4096,
    sha256_hash: "a".repeat(64),
    issue_date: "2026-01-01",
    expiry_date: "2027-01-01",
  });
  assertEquals(valid.sanitizedFilename, "Quality-Certificate.pdf");
  assertThrows(
    () =>
      parseCreateDocumentUpload({
        assessment_id: UUID_A,
        supplier_relationship_id: UUID_A,
        document_type: "quality_certificate",
        original_filename: "certificate.exe",
        mime_type: "application/pdf",
        byte_size: 4096,
        sha256_hash: "a".repeat(64),
      }),
    "does not match",
  );
  assertThrows(
    () =>
      parseCreateDocumentUpload({
        assessment_id: UUID_A,
        supplier_relationship_id: UUID_A,
        document_type: "quality_certificate",
        original_filename: "certificate.pdf",
        mime_type: "application/pdf",
        byte_size: 4096,
        sha256_hash: "a".repeat(64),
        issue_date: "2027-01-01",
        expiry_date: "2026-01-01",
      }),
    "cannot be before",
  );
  assertThrows(
    () =>
      parseCreateDocumentUpload({
        assessment_id: UUID_A,
        supplier_relationship_id: UUID_A,
        document_type: "quality_certificate",
        original_filename: "certificate.pdf",
        mime_type: "application/pdf",
        byte_size: 4096,
        sha256_hash: "a".repeat(64),
        issue_date: "2026-02-31",
      }),
    "YYYY-MM-DD",
  );
});

Deno.test("workflow payloads reject invalid IDs and incomplete business fields", () => {
  assertEquals(parseFinalizeDocumentUpload({ document_version_id: UUID_A }), {
    documentVersionId: UUID_A,
  });
  assertEquals(
    parseSubmitAssessment({
      assessment_id: UUID_A,
      supplier_declaration: "I confirm this fictional submission is complete.",
    }).assessmentId,
    UUID_A,
  );
  assertEquals(
    parseCreateFinding({
      assessment_id: UUID_A,
      severity: "medium",
      category: "document_control",
      title: "Replacement certificate required",
      description: "The submitted certificate expires before the review period.",
    }).severity,
    "medium",
  );
  assertEquals(
    parseSubmitCorrectiveAction({
      finding_id: UUID_A,
      root_cause: "The renewal reminder was not assigned.",
      correction: "A current fictional certificate was uploaded.",
      preventive_action: "A quarterly document review was added.",
      target_completion_date: "2026-08-01",
    }).findingId,
    UUID_A,
  );
});

Deno.test("conditional approvals require conditions and date ranges remain valid", () => {
  assertThrows(
    () =>
      parseRecordApprovalDecision({
        assessment_id: UUID_A,
        decision: "conditionally_approved",
        effective_from: "2026-07-01",
        internal_rationale: "Requirements are met subject to one tracked renewal.",
      }),
    "conditions are required",
  );
  assertThrows(
    () =>
      parseRecordApprovalDecision({
        assessment_id: UUID_A,
        decision: "approved",
        effective_from: "2026-07-01",
        valid_until: "2026-06-30",
        internal_rationale: "All required evidence has been reviewed and accepted.",
      }),
    "cannot be before",
  );
});

Deno.test("signed document URL lifetime is capped", () => {
  assertEquals(
    parseGetSignedDocumentUrl({ document_version_id: UUID_A }).expiresInSeconds,
    300,
  );
  assertThrows(
    () =>
      parseGetSignedDocumentUrl({
        document_version_id: UUID_A,
        expires_in_seconds: 3600,
      }),
    "between 60 and 600",
  );
});

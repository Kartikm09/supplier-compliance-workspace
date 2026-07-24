import { AppError } from "./errors.ts";
import {
  countryCode,
  emailAddress,
  isoDate,
  isoTimestamp,
  objectValue,
  optionalInteger,
  optionalString,
  optionalUuid,
  requiredEnum,
  requiredPositiveInteger,
  requiredString,
  requiredUuid,
  safeFilename,
  sha256Digest,
} from "./validation.ts";

export const EVIDENCE_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "image/png",
  "image/jpeg",
] as const;

const MIME_EXTENSIONS: Record<(typeof EVIDENCE_MIME_TYPES)[number], readonly string[]> = {
  "application/pdf": [".pdf"],
  "text/plain": [".txt", ".md"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
};

export interface CreateSupplierInvitationInput {
  buyerOrganizationId: string;
  intendedSupplierName: string;
  invitedEmail: string;
  expiresInHours: number;
}

export function parseCreateSupplierInvitation(value: unknown): CreateSupplierInvitationInput {
  const body = objectValue(value);
  return {
    buyerOrganizationId: requiredUuid(body.buyer_organization_id, "buyer_organization_id"),
    intendedSupplierName: requiredString(body.intended_supplier_name, "intended_supplier_name", {
      maximum: 160,
    }),
    invitedEmail: emailAddress(body.invited_email, "invited_email"),
    expiresInHours: optionalInteger(body.expires_in_hours, "expires_in_hours", 1, 168, 72),
  };
}

export interface AcceptSupplierInvitationInput {
  invitationToken: string;
  existingSupplierOrganizationId: string | null;
  newSupplier: {
    legalName: string;
    displayName: string;
    slug: string;
    countryCode: string;
  } | null;
}

export function parseAcceptSupplierInvitation(value: unknown): AcceptSupplierInvitationInput {
  const body = objectValue(value);
  const existingSupplierOrganizationId = optionalUuid(
    body.supplier_organization_id,
    "supplier_organization_id",
  );
  const newSupplierBody = body.new_supplier === undefined || body.new_supplier === null
    ? null
    : objectValue(body.new_supplier, "new_supplier");

  if ((existingSupplierOrganizationId === null) === (newSupplierBody === null)) {
    throw new AppError(
      422,
      "invalid_supplier_selection",
      "Provide either supplier_organization_id or new_supplier, but not both.",
    );
  }

  let newSupplier: AcceptSupplierInvitationInput["newSupplier"] = null;
  if (newSupplierBody) {
    const slug = requiredString(newSupplierBody.slug, "new_supplier.slug", { maximum: 80 })
      .toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new AppError(
        422,
        "invalid_field",
        "new_supplier.slug must contain lowercase letters, numbers, and single hyphens.",
      );
    }
    newSupplier = {
      legalName: requiredString(newSupplierBody.legal_name, "new_supplier.legal_name", {
        maximum: 180,
      }),
      displayName: requiredString(newSupplierBody.display_name, "new_supplier.display_name", {
        maximum: 140,
      }),
      slug,
      countryCode: countryCode(newSupplierBody.country_code, "new_supplier.country_code"),
    };
  }

  return {
    invitationToken: requiredString(body.invitation_token, "invitation_token", {
      minimum: 40,
      maximum: 180,
    }),
    existingSupplierOrganizationId,
    newSupplier,
  };
}

export interface CreateDocumentUploadInput {
  assessmentId: string;
  supplierRelationshipId: string;
  documentRequirementId: string | null;
  documentType: string;
  originalFilename: string;
  sanitizedFilename: string;
  mimeType: (typeof EVIDENCE_MIME_TYPES)[number];
  byteSize: number;
  sha256Hash: string;
  issueDate: string | null;
  expiryDate: string | null;
  issuingBody: string | null;
}

export function parseCreateDocumentUpload(value: unknown): CreateDocumentUploadInput {
  const body = objectValue(value);
  const originalFilename = requiredString(body.original_filename, "original_filename", {
    maximum: 180,
  });
  const sanitizedFilename = safeFilename(originalFilename);
  const mimeType = requiredEnum(body.mime_type, "mime_type", EVIDENCE_MIME_TYPES);
  const allowedExtensions = MIME_EXTENSIONS[mimeType];
  const lowerFilename = sanitizedFilename.toLowerCase();
  if (!allowedExtensions.some((extension) => lowerFilename.endsWith(extension))) {
    throw new AppError(
      422,
      "file_type_mismatch",
      "The filename extension does not match the declared MIME type.",
    );
  }

  const issueDate = isoDate(body.issue_date, "issue_date", true);
  const expiryDate = isoDate(body.expiry_date, "expiry_date", true);
  if (issueDate && expiryDate && expiryDate < issueDate) {
    throw new AppError(
      422,
      "invalid_date_range",
      "expiry_date cannot be before issue_date.",
    );
  }

  return {
    assessmentId: requiredUuid(body.assessment_id, "assessment_id"),
    supplierRelationshipId: requiredUuid(
      body.supplier_relationship_id,
      "supplier_relationship_id",
    ),
    documentRequirementId: optionalUuid(
      body.document_requirement_id,
      "document_requirement_id",
    ),
    documentType: requiredString(body.document_type, "document_type", { maximum: 80 }),
    originalFilename,
    sanitizedFilename,
    mimeType,
    byteSize: requiredPositiveInteger(body.byte_size, "byte_size", 10 * 1024 * 1024),
    sha256Hash: sha256Digest(body.sha256_hash, "sha256_hash"),
    issueDate,
    expiryDate,
    issuingBody: optionalString(body.issuing_body, "issuing_body", 180),
  };
}

export function parseFinalizeDocumentUpload(value: unknown): { documentVersionId: string } {
  const body = objectValue(value);
  return {
    documentVersionId: requiredUuid(body.document_version_id, "document_version_id"),
  };
}

export interface SubmitAssessmentInput {
  assessmentId: string;
  supplierDeclaration: string;
}

export function parseSubmitAssessment(value: unknown): SubmitAssessmentInput {
  const body = objectValue(value);
  return {
    assessmentId: requiredUuid(body.assessment_id, "assessment_id"),
    supplierDeclaration: requiredString(body.supplier_declaration, "supplier_declaration", {
      minimum: 20,
      maximum: 2_000,
    }),
  };
}

const FINDING_SEVERITIES = ["low", "medium", "high", "critical"] as const;

export interface CreateFindingInput {
  assessmentId: string;
  severity: (typeof FINDING_SEVERITIES)[number];
  category: string;
  title: string;
  description: string;
  internalNote: string | null;
  assignedSupplierUserId: string | null;
  dueAt: string | null;
}

export function parseCreateFinding(value: unknown): CreateFindingInput {
  const body = objectValue(value);
  const dueAt = body.due_at === undefined || body.due_at === null || body.due_at === ""
    ? null
    : isoTimestamp(body.due_at, "due_at");
  return {
    assessmentId: requiredUuid(body.assessment_id, "assessment_id"),
    severity: requiredEnum(body.severity, "severity", FINDING_SEVERITIES),
    category: requiredString(body.category, "category", { maximum: 80 }),
    title: requiredString(body.title, "title", { maximum: 180 }),
    description: requiredString(body.description, "description", {
      minimum: 10,
      maximum: 5_000,
    }),
    internalNote: optionalString(body.internal_note, "internal_note", 5_000),
    assignedSupplierUserId: optionalUuid(
      body.assigned_supplier_user_id,
      "assigned_supplier_user_id",
    ),
    dueAt,
  };
}

export interface SubmitCorrectiveActionInput {
  findingId: string;
  rootCause: string;
  correction: string;
  preventiveAction: string;
  targetCompletionDate: string;
}

export function parseSubmitCorrectiveAction(value: unknown): SubmitCorrectiveActionInput {
  const body = objectValue(value);
  return {
    findingId: requiredUuid(body.finding_id, "finding_id"),
    rootCause: requiredString(body.root_cause, "root_cause", { minimum: 10, maximum: 5_000 }),
    correction: requiredString(body.correction, "correction", { minimum: 10, maximum: 5_000 }),
    preventiveAction: requiredString(body.preventive_action, "preventive_action", {
      minimum: 10,
      maximum: 5_000,
    }),
    targetCompletionDate: isoDate(
      body.target_completion_date,
      "target_completion_date",
    ) as string,
  };
}

const APPROVAL_DECISIONS = [
  "approved",
  "conditionally_approved",
  "rejected",
  "deferred",
] as const;

export interface RecordApprovalDecisionInput {
  assessmentId: string;
  decision: (typeof APPROVAL_DECISIONS)[number];
  effectiveFrom: string;
  validUntil: string | null;
  conditions: string | null;
  internalRationale: string;
}

export function parseRecordApprovalDecision(value: unknown): RecordApprovalDecisionInput {
  const body = objectValue(value);
  const effectiveFrom = isoDate(body.effective_from, "effective_from") as string;
  const validUntil = isoDate(body.valid_until, "valid_until", true);
  if (validUntil && validUntil < effectiveFrom) {
    throw new AppError(
      422,
      "invalid_date_range",
      "valid_until cannot be before effective_from.",
    );
  }
  const decision = requiredEnum(body.decision, "decision", APPROVAL_DECISIONS);
  const conditions = optionalString(body.conditions, "conditions", 5_000);
  if (decision === "conditionally_approved" && !conditions) {
    throw new AppError(
      422,
      "conditions_required",
      "conditions are required for conditional approval.",
    );
  }
  return {
    assessmentId: requiredUuid(body.assessment_id, "assessment_id"),
    decision,
    effectiveFrom,
    validUntil,
    conditions,
    internalRationale: requiredString(body.internal_rationale, "internal_rationale", {
      minimum: 10,
      maximum: 5_000,
    }),
  };
}

export function parseGetSignedDocumentUrl(
  value: unknown,
): { documentVersionId: string; expiresInSeconds: number } {
  const body = objectValue(value);
  return {
    documentVersionId: requiredUuid(body.document_version_id, "document_version_id"),
    expiresInSeconds: optionalInteger(
      body.expires_in_seconds,
      "expires_in_seconds",
      60,
      600,
      300,
    ),
  };
}

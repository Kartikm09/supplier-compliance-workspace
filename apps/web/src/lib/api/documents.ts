import type {
  DocumentRequirement,
  DocumentVersion,
  OrganizationType,
  SupplierDocument,
} from "@scw/contracts";
import { z } from "zod";

import { invokeEdgeFunction, supabase } from "../supabase";

const createUploadResponseSchema = z.object({
  bucket: z.string().min(1).default("supplier-evidence"),
  document_id: z.uuid(),
  document_version_id: z.uuid(),
  storage_path: z.string().min(1),
  upload_token: z.string().min(1),
});

export interface DocumentCenterItem extends SupplierDocument {
  requirement: DocumentRequirement | null;
  versions: DocumentVersion[];
}

export async function loadDocumentCenter(
  organizationId: string,
  organizationType: OrganizationType,
): Promise<DocumentCenterItem[]> {
  const relationshipQuery = supabase.from("supplier_relationships").select("*");
  const { data: relationships, error: relationshipError } =
    organizationType === "buyer"
      ? await relationshipQuery.eq("buyer_organization_id", organizationId)
      : await relationshipQuery.eq("supplier_organization_id", organizationId);
  if (relationshipError) throw relationshipError;
  if (!relationships.length) return [];
  const { data: documents, error } = await supabase
    .from("documents")
    .select("*")
    .in(
      "supplier_relationship_id",
      relationships.map((relationship) => relationship.id),
    )
    .order("updated_at", { ascending: false });
  if (error) throw error;
  if (!documents.length) return [];
  const [versionResult, requirementResult] = await Promise.all([
    supabase
      .from("document_versions")
      .select("*")
      .in(
        "document_id",
        documents.map((document) => document.id),
      )
      .order("version_number", { ascending: false }),
    supabase
      .from("document_requirements")
      .select("*")
      .in(
        "id",
        documents
          .map((document) => document.document_requirement_id)
          .filter((id): id is string => Boolean(id)),
      ),
  ]);
  if (versionResult.error) throw versionResult.error;
  if (requirementResult.error) throw requirementResult.error;
  const versionsByDocument = new Map<string, DocumentVersion[]>();
  for (const version of versionResult.data) {
    const existing = versionsByDocument.get(version.document_id) ?? [];
    existing.push(version);
    versionsByDocument.set(version.document_id, existing);
  }
  const requirementById = new Map(
    requirementResult.data.map((requirement) => [requirement.id, requirement]),
  );
  return documents.map((document) => ({
    ...document,
    requirement: document.document_requirement_id
      ? (requirementById.get(document.document_requirement_id) ?? null)
      : null,
    versions: versionsByDocument.get(document.id) ?? [],
  }));
}

export async function uploadSupplierDocument(values: {
  assessmentId: string;
  documentRequirementId: string;
  documentType: string;
  expiryDate: string | null;
  file: File;
  issueDate: string | null;
  issuingBody: string | null;
  relationshipId: string;
}): Promise<{ documentId: string; documentVersionId: string }> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await values.file.arrayBuffer(),
  );
  const sha256Hash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const createData = await invokeEdgeFunction<unknown>(
    "create-document-upload",
    {
      assessment_id: values.assessmentId,
      byte_size: values.file.size,
      document_requirement_id: values.documentRequirementId,
      document_type: values.documentType,
      expiry_date: values.expiryDate,
      issue_date: values.issueDate,
      issuing_body: values.issuingBody,
      mime_type: values.file.type,
      original_filename: values.file.name,
      sha256_hash: sha256Hash,
      supplier_relationship_id: values.relationshipId,
    },
  );
  const upload = createUploadResponseSchema.parse(createData);
  const { error: uploadError } = await supabase.storage
    .from(upload.bucket)
    .uploadToSignedUrl(upload.storage_path, upload.upload_token, values.file, {
      contentType: values.file.type,
      upsert: false,
    });
  if (uploadError) throw uploadError;
  await invokeEdgeFunction<Record<string, unknown>>(
    "finalize-document-upload",
    {
      document_version_id: upload.document_version_id,
    },
  );
  return {
    documentId: upload.document_id,
    documentVersionId: upload.document_version_id,
  };
}

export async function getSignedDocumentUrl(
  documentVersionId: string,
): Promise<string> {
  const data = await invokeEdgeFunction<{
    signed_url: string;
  }>("get-signed-document-url", {
    document_version_id: documentVersionId,
  });
  if (!data?.signed_url)
    throw new Error("A signed document URL was not returned.");
  return data.signed_url;
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, Plus, Search, X } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Button } from "../components/Button";
import { DocumentVersionList } from "../components/DocumentVersionList";
import { TextField } from "../components/FormField";
import { PageHeader } from "../components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../context/ToastContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { loadAssessmentWorkspace } from "../lib/api/assessments";
import {
  getSignedDocumentUrl,
  loadDocumentCenter,
  uploadSupplierDocument,
} from "../lib/api/documents";
import { hasCapability } from "../lib/access";
import { errorMessage } from "../lib/errors";
import { formString } from "../lib/forms";

export function DocumentsPage() {
  const [searchParams] = useSearchParams();
  const assessmentId = searchParams.get("assessment");
  const requestedRequirementId = searchParams.get("requirement");
  const { organization, membership } = useWorkspace();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(Boolean(requestedRequirementId));
  const [busyVersionId, setBusyVersionId] = useState<string | null>(null);
  const canUpload =
    Boolean(membership) &&
    hasCapability(membership!.role, "contribute_supplier_data");
  const query = useQuery({
    queryKey: ["document-center", organization?.id],
    queryFn: () =>
      loadDocumentCenter(organization!.id, organization!.organization_type),
    enabled: Boolean(organization),
  });
  const assessmentQuery = useQuery({
    queryKey: ["assessment-workspace", assessmentId],
    queryFn: () => loadAssessmentWorkspace(assessmentId!),
    enabled: Boolean(assessmentId),
  });
  const uploadMutation = useMutation({
    mutationFn: uploadSupplierDocument,
    onSuccess: () => {
      setUploadOpen(false);
      notify("Document uploaded and queued for processing.", "success");
      void queryClient.invalidateQueries({ queryKey: ["document-center"] });
      void queryClient.invalidateQueries({
        queryKey: ["assessment-workspace", assessmentId],
      });
    },
    onError: (error) => notify(errorMessage(error), "error"),
  });
  const filtered = useMemo(
    () =>
      (query.data ?? []).filter((document) =>
        `${document.requirement?.name ?? ""} ${document.document_type}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [query.data, search],
  );
  const selectedRequirement = assessmentQuery.data?.requirements.find(
    (requirement) => requirement.id === requestedRequirementId,
  );

  const submitUpload = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    const requirementId =
      formString(form, "requirementId") || requestedRequirementId || "";
    const requirement = assessmentQuery.data?.requirements.find(
      (item) => item.id === requirementId,
    );
    if (!(file instanceof File) || !file.size || !requirement) {
      notify("Select a required document and file.", "error");
      return;
    }
    if (!requirement.accepted_mime_types.includes(file.type)) {
      notify(`File type ${file.type || "unknown"} is not accepted.`, "error");
      return;
    }
    if (file.size > requirement.maximum_size_bytes) {
      notify("The selected file exceeds the requirement size limit.", "error");
      return;
    }
    if (!assessmentQuery.data) return;
    uploadMutation.mutate({
      assessmentId: assessmentQuery.data.assessment.id,
      documentRequirementId: requirement.id,
      documentType: requirement.stable_requirement_key,
      expiryDate: formString(form, "expiryDate") || null,
      file,
      issueDate: formString(form, "issueDate") || null,
      issuingBody: formString(form, "issuingBody").trim() || null,
      relationshipId: assessmentQuery.data.relationship.id,
    });
  };

  const openVersion = async (versionId: string) => {
    setBusyVersionId(versionId);
    try {
      const signedUrl = await getSignedDocumentUrl(versionId);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setBusyVersionId(null);
    }
  };

  if (query.isLoading || (assessmentId && assessmentQuery.isLoading)) {
    return <LoadingState />;
  }
  const queryError = query.error ?? assessmentQuery.error;
  if (queryError) {
    return (
      <ErrorState
        message={errorMessage(queryError)}
        retry={() => {
          void query.refetch();
          if (assessmentId) void assessmentQuery.refetch();
        }}
      />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Private evidence"
        subtitle="Review upload status, expiry metadata, and immutable replacement history."
        title="Document center"
        actions={
          canUpload && assessmentQuery.data ? (
            <Button onClick={() => setUploadOpen(true)}>
              <Plus aria-hidden="true" size={17} />
              Upload evidence
            </Button>
          ) : undefined
        }
      />

      <div className="filter-bar">
        <label className="search-field">
          <Search aria-hidden="true" size={17} />
          <span className="sr-only">Search documents</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search document type"
            type="search"
            value={search}
          />
        </label>
        <span className="filter-count">{filtered.length} document records</span>
      </div>

      {filtered.length ? (
        <div className="document-groups">
          {filtered.map((document) => (
            <section className="section document-group" key={document.id}>
              <div className="section__header">
                <div>
                  <div className="inline-heading">
                    <h2>
                      {document.requirement?.name ?? document.document_type}
                    </h2>
                    <StatusBadge value={document.status} />
                  </div>
                  <p>
                    {document.requirement?.description ??
                      "Supplier evidence document."}
                  </p>
                </div>
                {canUpload &&
                assessmentQuery.data &&
                document.document_requirement_id ? (
                  <Button onClick={() => setUploadOpen(true)} tone="secondary">
                    <FileUp aria-hidden="true" size={16} />
                    New version
                  </Button>
                ) : null}
              </div>
              <DocumentVersionList
                busyVersionId={busyVersionId}
                onOpen={(version) => void openVersion(version.id)}
                versions={document.versions}
              />
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          action={
            canUpload && assessmentQuery.data ? (
              <Button onClick={() => setUploadOpen(true)}>
                <FileUp aria-hidden="true" size={16} />
                Upload first document
              </Button>
            ) : undefined
          }
          description="Evidence records appear after a controlled private upload."
          title="No documents found"
        />
      )}

      {uploadOpen && assessmentQuery.data ? (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="upload-title"
            aria-modal="true"
            className="modal"
            role="dialog"
          >
            <header className="modal__header">
              <div>
                <p className="eyebrow">Private evidence</p>
                <h2 id="upload-title">Upload document version</h2>
              </div>
              <button
                aria-label="Close upload dialog"
                className="icon-button"
                onClick={() => setUploadOpen(false)}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </header>
            <form className="stack-form" onSubmit={submitUpload}>
              <label className="field">
                <span className="field__label">Document requirement *</span>
                <select
                  defaultValue={selectedRequirement?.id ?? ""}
                  name="requirementId"
                  required
                >
                  <option value="">Select requirement</option>
                  {assessmentQuery.data.requirements.map((requirement) => (
                    <option key={requirement.id} value={requirement.id}>
                      {requirement.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="file-drop">
                <FileUp aria-hidden="true" size={22} />
                <span>Select evidence file</span>
                <small>
                  The selected requirement controls MIME type and size limits.
                </small>
                <input name="file" required type="file" />
              </label>
              <TextField label="Issuing body" name="issuingBody" />
              <div className="form-grid">
                <TextField label="Issue date" name="issueDate" type="date" />
                <TextField label="Expiry date" name="expiryDate" type="date" />
              </div>
              <div className="form-actions">
                <Button
                  onClick={() => setUploadOpen(false)}
                  tone="secondary"
                  type="button"
                >
                  Cancel
                </Button>
                <Button busy={uploadMutation.isPending} type="submit">
                  Upload securely
                </Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}

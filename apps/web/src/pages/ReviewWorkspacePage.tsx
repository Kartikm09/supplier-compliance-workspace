import type { AssessmentResponse, Question } from "@scw/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileOutput, Flag, Play, Scale, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Button } from "../components/Button";
import { DocumentReviewControl } from "../components/DocumentReviewControl";
import { DocumentVersionList } from "../components/DocumentVersionList";
import { SelectField, TextAreaField, TextField } from "../components/FormField";
import { InternalReviewPanel } from "../components/InternalReviewPanel";
import { PageHeader } from "../components/PageHeader";
import { ErrorState, LoadingState } from "../components/States";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../context/ToastContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { createFinding, generateAssessmentReport } from "../lib/api/actions";
import {
  loadAssessmentWorkspace,
  saveDocumentReview,
  transitionAssessmentStatus,
} from "../lib/api/assessments";
import { getSignedDocumentUrl } from "../lib/api/documents";
import { hasCapability } from "../lib/access";
import { errorMessage } from "../lib/errors";
import { formatDate } from "../lib/format";
import { formString, stringArray } from "../lib/forms";

function responseText(
  question: Question,
  response: AssessmentResponse | undefined,
): string {
  if (!response) return "No response";
  if (response.response_text) return response.response_text;
  if (response.response_number !== null)
    return String(response.response_number);
  if (response.response_boolean !== null)
    return response.response_boolean ? "Yes" : "No";
  if (response.response_date) return formatDate(response.response_date);
  if (response.response_option_id) return response.response_option_id;
  if (Array.isArray(response.response_json))
    return stringArray(response.response_json).join(", ");
  return "No response";
}

export function ReviewWorkspacePage() {
  const { assessmentId = "" } = useParams();
  const { membership, organization } = useWorkspace();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [findingOpen, setFindingOpen] = useState(false);
  const [busyVersionId, setBusyVersionId] = useState<string | null>(null);
  const [busyReviewId, setBusyReviewId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["assessment-workspace", assessmentId],
    queryFn: () => loadAssessmentWorkspace(assessmentId),
    enabled: Boolean(assessmentId),
  });
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: ["assessment-workspace", assessmentId],
    });
  const findingMutation = useMutation({
    mutationFn: createFinding,
    onSuccess: () => {
      setFindingOpen(false);
      notify("Finding created and supplier notification queued.", "success");
      void refresh();
    },
    onError: (error) => notify(errorMessage(error), "error"),
  });
  const transitionMutation = useMutation({
    mutationFn: transitionAssessmentStatus,
    onSuccess: () => {
      notify("Review status updated.", "success");
      void refresh();
    },
    onError: (error) => notify(errorMessage(error), "error"),
  });
  const reportMutation = useMutation({
    mutationFn: generateAssessmentReport,
    onSuccess: () =>
      notify("Assessment report queued for private generation.", "success"),
    onError: (error) => notify(errorMessage(error), "error"),
  });
  const canReview =
    Boolean(membership) &&
    hasCapability(membership!.role, "review_assessments");
  const canDecide =
    Boolean(membership) &&
    hasCapability(membership!.role, "decide_assessments");

  const submitFinding = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const dueAt = formString(form, "dueAt");
    findingMutation.mutate({
      assessmentId,
      category: formString(form, "category"),
      description: formString(form, "description"),
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      internalNote: formString(form, "internalNote").trim() || null,
      severity: formString(form, "severity") as
        | "low"
        | "medium"
        | "high"
        | "critical",
      title: formString(form, "title"),
    });
  };

  const reviewDocument = async (
    versionId: string,
    values: {
      internalNote: string | null;
      reviewerNote: string | null;
      status: "pending" | "accepted" | "rejected" | "replacement_requested";
    },
  ) => {
    setBusyReviewId(versionId);
    try {
      await saveDocumentReview({
        assessmentId,
        documentVersionId: versionId,
        internalNote: values.internalNote,
        reviewerNote: values.reviewerNote,
        status: values.status,
      });
      notify("Document review recorded.", "success");
      await refresh();
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setBusyReviewId(null);
    }
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

  if (query.isLoading) return <LoadingState />;
  if (query.error) {
    return (
      <ErrorState
        message={errorMessage(query.error)}
        retry={() => void query.refetch()}
      />
    );
  }
  if (!query.data || !organization) return null;
  const data = query.data;

  return (
    <>
      <PageHeader
        eyebrow={`Review · Program version ${data.version.version_number}`}
        subtitle={data.program.description}
        title={data.program.name}
        actions={
          <div className="button-row">
            {canReview &&
            ["submitted", "resubmitted"].includes(data.assessment.status) ? (
              <Button
                busy={transitionMutation.isPending}
                onClick={() =>
                  transitionMutation.mutate({
                    assessmentId,
                    expectedStatus: data.assessment.status,
                    nextStatus: "under_review",
                  })
                }
                tone="secondary"
              >
                <Play aria-hidden="true" size={16} />
                Start review
              </Button>
            ) : null}
            {canReview ? (
              <Button onClick={() => setFindingOpen(true)} tone="secondary">
                <Flag aria-hidden="true" size={16} />
                Create finding
              </Button>
            ) : null}
            {canDecide ? (
              <Link
                className="button button--primary"
                to={`/decisions/${assessmentId}`}
              >
                <Scale aria-hidden="true" size={16} />
                Decision
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="review-overview">
        <dl className="detail-list detail-list--horizontal">
          <div>
            <dt>Status</dt>
            <dd>
              <StatusBadge value={data.assessment.status} />
            </dd>
          </div>
          <div>
            <dt>Completion</dt>
            <dd>{data.assessment.completeness_percentage}%</dd>
          </div>
          <div>
            <dt>Submitted</dt>
            <dd>{formatDate(data.assessment.submitted_at)}</dd>
          </div>
          <div>
            <dt>Declaration</dt>
            <dd>{data.assessment.supplier_declaration ?? "Not provided"}</dd>
          </div>
        </dl>
      </div>

      <div className="review-layout">
        <div>
          {data.sections.map((section) => (
            <section className="section response-review" key={section.id}>
              <div className="section__header">
                <div>
                  <h2>{section.title}</h2>
                  {section.description ? <p>{section.description}</p> : null}
                </div>
              </div>
              <dl className="answer-list">
                {data.questions
                  .filter((question) => question.section_id === section.id)
                  .map((question) => (
                    <div key={question.id}>
                      <dt>
                        {question.prompt}
                        {question.required ? " *" : ""}
                      </dt>
                      <dd>
                        {responseText(
                          question,
                          data.responses.find(
                            (response) => response.question_id === question.id,
                          ),
                        )}
                      </dd>
                    </div>
                  ))}
              </dl>
            </section>
          ))}

          <section className="section">
            <div className="section__header">
              <div>
                <h2>Evidence review</h2>
                <p>
                  Open through short-lived signed URLs and record a decision.
                </p>
              </div>
            </div>
            <div className="review-documents">
              {data.documents.map((document) => {
                const latest = document.versions[0];
                return (
                  <article key={document.id}>
                    <h3>
                      {data.requirements.find(
                        (requirement) =>
                          requirement.id === document.document_requirement_id,
                      )?.name ?? document.document_type}
                    </h3>
                    <DocumentVersionList
                      busyVersionId={busyVersionId}
                      onOpen={(version) => void openVersion(version.id)}
                      versions={document.versions}
                    />
                    {latest && canReview ? (
                      <DocumentReviewControl
                        busy={busyReviewId === latest.id}
                        currentReview={data.documentReviews.find(
                          (review) => review.document_version_id === latest.id,
                        )}
                        onReview={(values) =>
                          void reviewDocument(latest.id, values)
                        }
                        version={latest}
                      />
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="section">
            <div className="section__header">
              <div>
                <h2>Findings</h2>
                <p>
                  Supplier-facing issue text and buyer-internal notes stay
                  separate.
                </p>
              </div>
            </div>
            <ul className="finding-list">
              {data.findings.map((finding) => (
                <li id={`finding-${finding.id}`} key={finding.id}>
                  <div>
                    <strong>
                      #{finding.finding_number} {finding.title}
                    </strong>
                    <p>{finding.description}</p>
                    {finding.internal_note ? (
                      <div className="internal-note">
                        <strong>Internal note</strong>
                        <p>{finding.internal_note}</p>
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <StatusBadge value={finding.severity} />
                    <StatusBadge value={finding.status} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="review-sidebar">
          <InternalReviewPanel
            organizationType={organization.organization_type}
            riskEvaluations={data.riskEvaluations}
          />
          <section className="section">
            <h3>Review output</h3>
            <p>
              Generate a private, demonstration-marked PDF after the review is
              complete.
            </p>
            <Button
              busy={reportMutation.isPending}
              onClick={() => reportMutation.mutate(assessmentId)}
              tone="secondary"
            >
              <FileOutput aria-hidden="true" size={16} />
              Generate report
            </Button>
          </section>
        </aside>
      </div>

      {findingOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="finding-title"
            aria-modal="true"
            className="modal"
            role="dialog"
          >
            <header className="modal__header">
              <div>
                <p className="eyebrow">Review issue</p>
                <h2 id="finding-title">Create finding</h2>
              </div>
              <button
                aria-label="Close finding dialog"
                className="icon-button"
                onClick={() => setFindingOpen(false)}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </header>
            <form className="stack-form" onSubmit={submitFinding}>
              <div className="form-grid">
                <SelectField label="Severity" name="severity" required>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </SelectField>
                <TextField label="Category" name="category" required />
              </div>
              <TextField label="Finding title" name="title" required />
              <TextAreaField
                label="Supplier-visible description"
                name="description"
                required
                rows={4}
              />
              <TextAreaField
                hint="Never returned to supplier sessions."
                label="Buyer internal note"
                name="internalNote"
                rows={3}
              />
              <TextField label="Response due" name="dueAt" type="date" />
              <div className="form-actions">
                <Button
                  onClick={() => setFindingOpen(false)}
                  tone="secondary"
                  type="button"
                >
                  Cancel
                </Button>
                <Button busy={findingMutation.isPending} type="submit">
                  Create finding
                </Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, FileCheck2, Send } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PageHeader } from "../components/PageHeader";
import { QuestionResponseField } from "../components/QuestionResponseField";
import { ErrorState, LoadingState } from "../components/States";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useWorkspace } from "../context/WorkspaceContext";
import {
  loadAssessmentWorkspace,
  saveAssessmentResponse,
  submitAssessment,
  type ResponseDraft,
} from "../lib/api/assessments";
import { validateAssessmentCompletion } from "../lib/assessment";
import { hasCapability } from "../lib/access";
import { errorMessage } from "../lib/errors";
import { titleCase } from "../lib/format";

export function AssessmentWorkspacePage() {
  const { assessmentId = "" } = useParams();
  const { user } = useAuth();
  const { membership } = useWorkspace();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [declaration, setDeclaration] = useState("");
  const [submitOpen, setSubmitOpen] = useState(false);
  const query = useQuery({
    queryKey: ["assessment-workspace", assessmentId],
    queryFn: () => loadAssessmentWorkspace(assessmentId),
    enabled: Boolean(assessmentId),
  });
  const submitMutation = useMutation({
    mutationFn: submitAssessment,
    onSuccess: () => {
      setSubmitOpen(false);
      notify("Assessment submitted for buyer review.", "success");
      void queryClient.invalidateQueries({
        queryKey: ["assessment-workspace", assessmentId],
      });
    },
    onError: (error) => notify(errorMessage(error), "error"),
  });

  const data = query.data;
  const completion = useMemo(
    () =>
      data
        ? validateAssessmentCompletion(
            data.questions,
            data.responses,
            data.requirements,
            data.documents,
          )
        : null,
    [data],
  );
  const editable =
    Boolean(membership) &&
    hasCapability(membership!.role, "contribute_supplier_data") &&
    Boolean(
      data &&
        ["draft", "in_progress", "changes_requested"].includes(
          data.assessment.status,
        ),
    );
  const canSubmit =
    Boolean(membership) &&
    hasCapability(membership!.role, "submit_assessment") &&
    Boolean(completion?.complete) &&
    declaration.trim().length >= 20;

  const saveResponse = useCallback(
    async (questionId: string, draft: ResponseDraft) => {
      if (!user) throw new Error("Sign in is required.");
      await saveAssessmentResponse({
        assessmentId,
        draft,
        questionId,
        userId: user.id,
      });
      await queryClient.invalidateQueries({
        queryKey: ["assessment-workspace", assessmentId],
      });
    },
    [assessmentId, queryClient, user],
  );

  if (query.isLoading) return <LoadingState />;
  if (query.error) {
    return (
      <ErrorState
        message={errorMessage(query.error)}
        retry={() => void query.refetch()}
      />
    );
  }
  if (!data || !completion) return null;

  return (
    <>
      <PageHeader
        eyebrow={`Version ${data.version.version_number} · ${titleCase(data.assessment.status)}`}
        subtitle={data.program.description}
        title={data.program.name}
        actions={<StatusBadge value={data.assessment.status} />}
      />

      <div className="assessment-progress">
        <div>
          <span>Submission readiness</span>
          <strong>{completion.percentage}%</strong>
        </div>
        <progress max={100} value={completion.percentage} />
        <p>
          {completion.complete
            ? "All required questions and document records are present."
            : `${completion.missingQuestionIds.length} required answers and ${completion.missingDocumentRequirementIds.length} required documents remain.`}
        </p>
      </div>

      <div className="assessment-layout">
        <aside className="assessment-nav">
          <strong>Sections</strong>
          <nav aria-label="Questionnaire sections">
            {data.sections.map((section) => (
              <a href={`#section-${section.id}`} key={section.id}>
                {section.title}
                <span>
                  {
                    data.questions.filter(
                      (question) => question.section_id === section.id,
                    ).length
                  }
                </span>
              </a>
            ))}
            <a href="#assessment-evidence">Evidence</a>
            <a href="#assessment-submit">Submit</a>
          </nav>
        </aside>

        <div className="assessment-content">
          {!editable ? (
            <div className="read-only-banner">
              <FileCheck2 aria-hidden="true" size={18} />
              Responses are read-only while this assessment is{" "}
              {titleCase(data.assessment.status)}.
            </div>
          ) : null}
          {data.sections.map((section) => (
            <section
              className="question-section"
              id={`section-${section.id}`}
              key={section.id}
            >
              <header>
                <p className="eyebrow">Section {section.display_order + 1}</p>
                <h2>{section.title}</h2>
                {section.description ? <p>{section.description}</p> : null}
              </header>
              {data.questions
                .filter((question) => question.section_id === section.id)
                .map((question) => (
                  <QuestionResponseField
                    disabled={!editable}
                    key={question.id}
                    onSave={(draft) => saveResponse(question.id, draft)}
                    options={data.questionOptions}
                    question={question}
                    response={data.responses.find(
                      (response) => response.question_id === question.id,
                    )}
                  />
                ))}
            </section>
          ))}

          <section className="question-section" id="assessment-evidence">
            <header>
              <p className="eyebrow">Evidence</p>
              <h2>Required documents</h2>
              <p>
                Uploads are private and replacements create immutable version
                history.
              </p>
            </header>
            <ul className="evidence-checklist">
              {data.requirements.map((requirement) => {
                const document = data.documents.find(
                  (item) =>
                    item.document_requirement_id === requirement.id &&
                    item.status !== "rejected",
                );
                return (
                  <li key={requirement.id}>
                    {document ? (
                      <CheckCircle2
                        aria-label="Provided"
                        className="text-positive"
                        size={20}
                      />
                    ) : (
                      <AlertCircle
                        aria-label="Missing"
                        className="text-warning"
                        size={20}
                      />
                    )}
                    <div>
                      <strong>{requirement.name}</strong>
                      <span>
                        {requirement.required ? "Required" : "Optional"}
                        {document
                          ? ` · ${document.versions.length} version${document.versions.length === 1 ? "" : "s"}`
                          : " · Not provided"}
                      </span>
                    </div>
                    <Link
                      className="button button--secondary"
                      to={`/documents?assessment=${assessmentId}&requirement=${requirement.id}`}
                    >
                      {document ? "View versions" : "Upload"}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="question-section" id="assessment-submit">
            <header>
              <p className="eyebrow">Formal submission</p>
              <h2>Review and declare</h2>
              <p>
                Submission creates a locked review snapshot for this program
                version.
              </p>
            </header>
            <label className="field">
              <span className="field__label">Supplier declaration *</span>
              <textarea
                disabled={!editable}
                onChange={(event) => setDeclaration(event.target.value)}
                placeholder="I confirm that the information and evidence supplied are accurate to the best of my knowledge."
                rows={4}
                value={declaration}
              />
              <span className="field__help">
                At least 20 characters. Your user identity and submission time
                are audited.
              </span>
            </label>
            {!completion.complete ? (
              <div className="validation-summary" role="alert">
                <AlertCircle aria-hidden="true" size={18} />
                Complete all required questions and evidence before submitting.
              </div>
            ) : null}
            <div className="form-actions">
              <Button disabled={!canSubmit} onClick={() => setSubmitOpen(true)}>
                <Send aria-hidden="true" size={16} />
                Submit for review
              </Button>
            </div>
          </section>
        </div>
      </div>

      <ConfirmDialog
        busy={submitMutation.isPending}
        confirmLabel="Submit assessment"
        description="Your current responses and document references will be preserved as the review snapshot. Further edits require a buyer change request."
        onCancel={() => setSubmitOpen(false)}
        onConfirm={() =>
          submitMutation.mutate({
            assessmentId,
            declaration,
          })
        }
        open={submitOpen}
        title="Submit this assessment?"
      />
    </>
  );
}

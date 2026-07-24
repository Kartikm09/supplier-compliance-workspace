import {
  answerTypeSchema,
  documentRequirementSchema,
  questionSchema,
} from "@scw/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CopyPlus, Send, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SelectField, TextAreaField, TextField } from "../components/FormField";
import { PageHeader } from "../components/PageHeader";
import { ProgramVersionEditor } from "../components/ProgramVersionEditor";
import { ErrorState, LoadingState } from "../components/States";
import { useToast } from "../context/ToastContext";
import { useWorkspace } from "../context/WorkspaceContext";
import {
  createDraftVersion,
  loadProgramWorkspace,
  publishProgramVersion,
  saveQuestion,
  saveRequirement,
  saveSection,
} from "../lib/api/programs";
import { hasCapability } from "../lib/access";
import { errorMessage } from "../lib/errors";
import { formString } from "../lib/forms";

type EditorModal = "section" | "question" | "requirement" | null;

export function ProgramBuilderPage() {
  const { programId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { membership } = useWorkspace();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<EditorModal>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const canManage = membership
    ? hasCapability(membership.role, "manage_programs")
    : false;
  const query = useQuery({
    queryKey: ["program", programId, searchParams.get("version")],
    queryFn: () =>
      loadProgramWorkspace(programId, searchParams.get("version") ?? undefined),
    enabled: Boolean(programId),
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["program", programId] });
  const sectionMutation = useMutation({
    mutationFn: saveSection,
    onSuccess: () => {
      setModal(null);
      notify("Questionnaire section added.", "success");
      void refresh();
    },
    onError: (error) => notify(errorMessage(error), "error"),
  });
  const questionMutation = useMutation({
    mutationFn: saveQuestion,
    onSuccess: () => {
      setModal(null);
      notify("Question added to the draft.", "success");
      void refresh();
    },
    onError: (error) => notify(errorMessage(error), "error"),
  });
  const requirementMutation = useMutation({
    mutationFn: saveRequirement,
    onSuccess: () => {
      setModal(null);
      notify("Document requirement added.", "success");
      void refresh();
    },
    onError: (error) => notify(errorMessage(error), "error"),
  });
  const draftMutation = useMutation({
    mutationFn: () =>
      createDraftVersion(
        programId,
        Math.max(
          ...(query.data?.versions.map((version) => version.version_number) ?? [
            0,
          ]),
        ),
      ),
    onSuccess: (version) => {
      setSearchParams({ version: version.id });
      notify(`Draft version ${version.version_number} created.`, "success");
      void refresh();
    },
    onError: (error) => notify(errorMessage(error), "error"),
  });
  const publishMutation = useMutation({
    mutationFn: publishProgramVersion,
    onSuccess: () => {
      setPublishOpen(false);
      notify("Program version published and locked.", "success");
      void refresh();
    },
    onError: (error) => notify(errorMessage(error), "error"),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.error) {
    return (
      <ErrorState
        message={errorMessage(query.error)}
        retry={() => void query.refetch()}
      />
    );
  }
  if (!query.data) return null;
  const editable = canManage && query.data.selectedVersion.status === "draft";

  const submitSection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    sectionMutation.mutate({
      description: formString(form, "description").trim() || null,
      displayOrder: query.data.sections.length,
      programVersionId: query.data.selectedVersion.id,
      title: formString(form, "title"),
    });
  };
  const submitQuestion = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = questionSchema.safeParse({
      answer_type: formString(form, "answerType"),
      display_order: query.data.questions.length,
      help_text: formString(form, "helpText").trim() || null,
      program_version_id: query.data.selectedVersion.id,
      prompt: formString(form, "prompt"),
      required: formString(form, "required") === "on",
      risk_weight: Number(formString(form, "riskWeight") || 0),
      section_id: formString(form, "sectionId"),
      stable_question_key: formString(form, "key"),
    });
    if (!parsed.success) {
      notify(
        parsed.error.issues[0]?.message ?? "Review the question.",
        "error",
      );
      return;
    }
    questionMutation.mutate({
      ...parsed.data,
      help_text: parsed.data.help_text ?? null,
    });
  };
  const submitRequirement = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = documentRequirementSchema.safeParse({
      accepted_mime_types: formString(form, "mimeTypes")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      description: formString(form, "description").trim() || null,
      display_order: query.data.requirements.length,
      maximum_size_bytes:
        Number(formString(form, "maximumSizeMb") || 10) * 1024 * 1024,
      minimum_validity_days: Number(
        formString(form, "minimumValidityDays") || 0,
      ),
      name: formString(form, "name"),
      program_version_id: query.data.selectedVersion.id,
      required: formString(form, "required") === "on",
      requires_expiry_date: formString(form, "requiresExpiry") === "on",
      requires_issue_date: formString(form, "requiresIssue") === "on",
      stable_requirement_key: formString(form, "key"),
    });
    if (!parsed.success) {
      notify(
        parsed.error.issues[0]?.message ?? "Review the requirement.",
        "error",
      );
      return;
    }
    requirementMutation.mutate({
      ...parsed.data,
      description: parsed.data.description ?? null,
    });
  };

  return (
    <>
      <PageHeader
        eyebrow={query.data.program.category}
        subtitle={query.data.program.description}
        title={query.data.program.name}
        actions={
          <div className="button-row">
            {canManage &&
            !query.data.versions.some(
              (version) => version.status === "draft",
            ) ? (
              <Button
                busy={draftMutation.isPending}
                onClick={() => draftMutation.mutate()}
                tone="secondary"
              >
                <CopyPlus aria-hidden="true" size={16} />
                New draft
              </Button>
            ) : null}
            {editable ? (
              <Button onClick={() => setPublishOpen(true)}>
                <Send aria-hidden="true" size={16} />
                Publish version
              </Button>
            ) : null}
          </div>
        }
      />

      <div
        className="version-tabs"
        role="tablist"
        aria-label="Program versions"
      >
        {query.data.versions.map((version) => (
          <button
            aria-selected={version.id === query.data?.selectedVersion.id}
            className={
              version.id === query.data?.selectedVersion.id
                ? "version-tab version-tab--active"
                : "version-tab"
            }
            key={version.id}
            onClick={() => setSearchParams({ version: version.id })}
            role="tab"
            type="button"
          >
            v{version.version_number}
            {version.status === "active" ? (
              <CheckCircle2 aria-label="Active" size={14} />
            ) : null}
          </button>
        ))}
      </div>

      <ProgramVersionEditor
        canEdit={canManage}
        onAddQuestion={() => setModal("question")}
        onAddRequirement={() => setModal("requirement")}
        onAddSection={() => setModal("section")}
        questions={query.data.questions}
        requirements={query.data.requirements}
        sections={query.data.sections}
        version={query.data.selectedVersion}
      />

      {modal ? (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="builder-modal-title"
            aria-modal="true"
            className="modal"
            role="dialog"
          >
            <header className="modal__header">
              <div>
                <p className="eyebrow">Draft version</p>
                <h2 id="builder-modal-title">
                  {modal === "section"
                    ? "Add section"
                    : modal === "question"
                      ? "Add question"
                      : "Add document requirement"}
                </h2>
              </div>
              <button
                aria-label="Close editor"
                className="icon-button"
                onClick={() => setModal(null)}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </header>
            {modal === "section" ? (
              <form className="stack-form" onSubmit={submitSection}>
                <TextField label="Section title" name="title" required />
                <TextAreaField
                  label="Description"
                  name="description"
                  rows={3}
                />
                <FormSubmit
                  busy={sectionMutation.isPending}
                  onCancel={() => setModal(null)}
                />
              </form>
            ) : null}
            {modal === "question" ? (
              <form className="stack-form" onSubmit={submitQuestion}>
                <SelectField label="Section" name="sectionId" required>
                  <option value="">Select section</option>
                  {query.data.sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.title}
                    </option>
                  ))}
                </SelectField>
                <TextField
                  hint="Stable lowercase identifier, for example quality_certified."
                  label="Question key"
                  name="key"
                  pattern="[a-z0-9_]+"
                  required
                />
                <TextAreaField
                  label="Question"
                  name="prompt"
                  required
                  rows={3}
                />
                <TextField label="Help text" name="helpText" />
                <div className="form-grid">
                  <SelectField label="Answer type" name="answerType" required>
                    {answerTypeSchema.options.map((answerType) => (
                      <option key={answerType} value={answerType}>
                        {answerType.replaceAll("_", " ")}
                      </option>
                    ))}
                  </SelectField>
                  <TextField
                    defaultValue="0"
                    label="Risk weight"
                    max={100}
                    min={0}
                    name="riskWeight"
                    type="number"
                  />
                </div>
                <label className="check-field">
                  <input name="required" type="checkbox" />
                  <span>Required for submission</span>
                </label>
                <FormSubmit
                  busy={questionMutation.isPending}
                  onCancel={() => setModal(null)}
                />
              </form>
            ) : null}
            {modal === "requirement" ? (
              <form className="stack-form" onSubmit={submitRequirement}>
                <TextField label="Requirement name" name="name" required />
                <TextField
                  label="Requirement key"
                  name="key"
                  pattern="[a-z0-9_]+"
                  required
                />
                <TextAreaField
                  label="Supplier guidance"
                  name="description"
                  rows={3}
                />
                <TextField
                  defaultValue="application/pdf"
                  hint="Comma-separated MIME types."
                  label="Accepted MIME types"
                  name="mimeTypes"
                  required
                />
                <div className="form-grid">
                  <TextField
                    defaultValue="10"
                    label="Maximum size (MB)"
                    max={25}
                    min={1}
                    name="maximumSizeMb"
                    required
                    type="number"
                  />
                  <TextField
                    defaultValue="0"
                    label="Minimum validity (days)"
                    min={0}
                    name="minimumValidityDays"
                    type="number"
                  />
                </div>
                <div className="check-grid">
                  <label className="check-field">
                    <input defaultChecked name="required" type="checkbox" />
                    <span>Required</span>
                  </label>
                  <label className="check-field">
                    <input name="requiresIssue" type="checkbox" />
                    <span>Issue date required</span>
                  </label>
                  <label className="check-field">
                    <input name="requiresExpiry" type="checkbox" />
                    <span>Expiry date required</span>
                  </label>
                </div>
                <FormSubmit
                  busy={requirementMutation.isPending}
                  onCancel={() => setModal(null)}
                />
              </form>
            ) : null}
          </section>
        </div>
      ) : null}

      <ConfirmDialog
        busy={publishMutation.isPending}
        confirmLabel="Publish and lock"
        description="Publishing makes this questionnaire and its document requirements immutable. New changes require another version."
        onCancel={() => setPublishOpen(false)}
        onConfirm={() => publishMutation.mutate(query.data.selectedVersion.id)}
        open={publishOpen}
        title={`Publish version ${query.data.selectedVersion.version_number}?`}
      />
    </>
  );
}

function FormSubmit({
  busy,
  onCancel,
}: {
  busy: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="form-actions">
      <Button onClick={onCancel} tone="secondary" type="button">
        Cancel
      </Button>
      <Button busy={busy} type="submit">
        Save
      </Button>
    </div>
  );
}

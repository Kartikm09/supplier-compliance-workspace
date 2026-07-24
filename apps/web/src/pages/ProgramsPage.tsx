import { programSchema } from "@scw/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FilePlus2, Layers3, Plus, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../components/Button";
import { SelectField, TextAreaField, TextField } from "../components/FormField";
import { PageHeader } from "../components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { createProgram, loadPrograms } from "../lib/api/programs";
import { hasCapability } from "../lib/access";
import { errorMessage } from "../lib/errors";
import { formString } from "../lib/forms";
import { formatDate } from "../lib/format";

export function ProgramsPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const { organization, membership } = useWorkspace();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const canManage = membership
    ? hasCapability(membership.role, "manage_programs")
    : false;
  const query = useQuery({
    queryKey: ["programs", organization?.id],
    queryFn: () => loadPrograms(organization!.id),
    enabled: Boolean(organization?.organization_type === "buyer"),
  });
  const createMutation = useMutation({
    mutationFn: createProgram,
    onSuccess: () => {
      notify("Qualification program created.", "success");
      setCreateOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["programs"] });
    },
    onError: (error) => notify(errorMessage(error), "error"),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organization || !user) return;
    const form = new FormData(event.currentTarget);
    const values = {
      buyer_organization_id: organization.id,
      category: formString(form, "category"),
      description: formString(form, "description"),
      name: formString(form, "name"),
    };
    const parsed = programSchema.safeParse(values);
    if (!parsed.success) {
      notify(
        parsed.error.issues[0]?.message ?? "Review the program details.",
        "error",
      );
      return;
    }
    createMutation.mutate({
      buyerOrganizationId: parsed.data.buyer_organization_id,
      category: parsed.data.category,
      createdBy: user.id,
      description: parsed.data.description,
      name: parsed.data.name,
    });
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

  return (
    <>
      <PageHeader
        eyebrow="Buyer configuration"
        subtitle="Create versioned questionnaires and evidence rules without changing assessments already in progress."
        title="Qualification programs"
        actions={
          canManage ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden="true" size={17} />
              New program
            </Button>
          ) : undefined
        }
      />

      {query.data?.length ? (
        <div className="program-list">
          {query.data.map((program) => (
            <article className="program-row" key={program.id}>
              <div className="program-row__icon" aria-hidden="true">
                <Layers3 size={20} />
              </div>
              <div className="program-row__main">
                <div>
                  <Link to={`/programs/${program.id}`}>{program.name}</Link>
                  <StatusBadge value={program.status} />
                </div>
                <p>{program.description}</p>
                <span>
                  {program.category} · Updated {formatDate(program.updated_at)}
                </span>
              </div>
              <div className="program-row__version">
                <span>Current version</span>
                <strong>
                  {program.currentVersion
                    ? `v${program.currentVersion.version_number}`
                    : "Draft only"}
                </strong>
              </div>
              <Link
                aria-label={`Open ${program.name}`}
                className="button button--secondary"
                to={`/programs/${program.id}`}
              >
                Configure
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          action={
            canManage ? (
              <Button onClick={() => setCreateOpen(true)}>
                <FilePlus2 aria-hidden="true" size={16} />
                Create first program
              </Button>
            ) : undefined
          }
          description="A program defines the versioned questions and evidence a supplier must submit."
          title="No qualification programs"
        />
      )}

      {createOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="program-title"
            aria-modal="true"
            className="modal"
            role="dialog"
          >
            <header className="modal__header">
              <div>
                <p className="eyebrow">Draft definition</p>
                <h2 id="program-title">New qualification program</h2>
              </div>
              <button
                aria-label="Close program dialog"
                className="icon-button"
                onClick={() => setCreateOpen(false)}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </header>
            <form className="stack-form" onSubmit={(event) => submit(event)}>
              <TextField label="Program name" name="name" required />
              <SelectField label="Category" name="category" required>
                <option value="">Select category</option>
                <option value="Standard qualification">
                  Standard qualification
                </option>
                <option value="Information security">
                  Information security
                </option>
                <option value="Quality management">Quality management</option>
                <option value="Environmental">Environmental</option>
              </SelectField>
              <TextAreaField
                label="Description"
                name="description"
                required
                rows={4}
              />
              <div className="form-actions">
                <Button
                  onClick={() => setCreateOpen(false)}
                  tone="secondary"
                  type="button"
                >
                  Cancel
                </Button>
                <Button busy={createMutation.isPending} type="submit">
                  Create draft
                </Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}

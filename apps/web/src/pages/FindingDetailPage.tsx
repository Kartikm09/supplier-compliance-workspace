import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { type FormEvent } from "react";
import { useParams } from "react-router-dom";

import { Button } from "../components/Button";
import { FindingTimeline } from "../components/FindingTimeline";
import { TextAreaField, TextField } from "../components/FormField";
import { PageHeader } from "../components/PageHeader";
import { ErrorState, LoadingState } from "../components/States";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../context/ToastContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { submitCorrectiveAction } from "../lib/api/actions";
import { loadFindingDetail } from "../lib/api/findings";
import { hasCapability } from "../lib/access";
import { errorMessage } from "../lib/errors";
import { formString } from "../lib/forms";

export function FindingDetailPage() {
  const { findingId = "" } = useParams();
  const { organization, membership } = useWorkspace();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["finding", findingId],
    queryFn: () => loadFindingDetail(findingId),
    enabled: Boolean(findingId),
  });
  const mutation = useMutation({
    mutationFn: submitCorrectiveAction,
    onSuccess: () => {
      notify("Corrective action submitted for buyer verification.", "success");
      void queryClient.invalidateQueries({ queryKey: ["finding", findingId] });
    },
    onError: (error) => notify(errorMessage(error), "error"),
  });
  const canRespond =
    Boolean(membership) &&
    hasCapability(membership!.role, "contribute_supplier_data") &&
    Boolean(
      query.data &&
        ["open", "response_required", "rejected"].includes(
          query.data.finding.status,
        ),
    );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    mutation.mutate({
      correction: formString(form, "correction"),
      findingId,
      preventiveAction: formString(form, "preventiveAction"),
      rootCause: formString(form, "rootCause"),
      targetCompletionDate: formString(form, "targetDate"),
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
  if (!query.data || !organization) return null;
  const { finding } = query.data;

  return (
    <>
      <PageHeader
        eyebrow={`Finding #${finding.finding_number} · ${finding.category}`}
        subtitle={finding.description}
        title={finding.title}
        actions={
          <div className="button-row">
            <StatusBadge value={finding.severity} />
            <StatusBadge value={finding.status} />
          </div>
        }
      />

      <div className="detail-grid">
        <section className="section">
          <div className="section__header">
            <div>
              <h2>Supplier response</h2>
              <p>
                Latest corrective-action submission and verification result.
              </p>
            </div>
          </div>
          {query.data.correctiveActions[0] ? (
            <dl className="narrative-list">
              <div>
                <dt>Root cause</dt>
                <dd>{query.data.correctiveActions[0].root_cause}</dd>
              </div>
              <div>
                <dt>Immediate correction</dt>
                <dd>{query.data.correctiveActions[0].correction}</dd>
              </div>
              <div>
                <dt>Preventive action</dt>
                <dd>{query.data.correctiveActions[0].preventive_action}</dd>
              </div>
              {query.data.correctiveActions[0].verification_note ? (
                <div>
                  <dt>Buyer verification</dt>
                  <dd>{query.data.correctiveActions[0].verification_note}</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="muted-copy">
              No corrective action has been submitted.
            </p>
          )}
        </section>

        <section className="section">
          <div className="section__header">
            <div>
              <h2>Shared timeline</h2>
              <p>
                {organization.organization_type === "buyer"
                  ? "Buyer history includes internal and supplier-visible events."
                  : "Only events marked supplier-visible are rendered here."}
              </p>
            </div>
          </div>
          <FindingTimeline
            events={query.data.events}
            organizationType={organization.organization_type}
          />
        </section>
      </div>

      {canRespond ? (
        <section className="section">
          <div className="section__header">
            <div>
              <h2>Submit corrective action</h2>
              <p>
                Explain the root cause, immediate correction, and prevention
                plan clearly.
              </p>
            </div>
          </div>
          <form className="stack-form stack-form--wide" onSubmit={submit}>
            <TextAreaField
              label="Root cause"
              minLength={10}
              name="rootCause"
              required
              rows={4}
            />
            <TextAreaField
              label="Immediate correction"
              minLength={10}
              name="correction"
              required
              rows={4}
            />
            <TextAreaField
              label="Preventive action"
              minLength={10}
              name="preventiveAction"
              required
              rows={4}
            />
            <TextField
              label="Target completion date"
              name="targetDate"
              required
              type="date"
            />
            <div className="form-actions">
              <Button busy={mutation.isPending} type="submit">
                <Send aria-hidden="true" size={16} />
                Submit for verification
              </Button>
            </div>
          </form>
        </section>
      ) : null}
    </>
  );
}

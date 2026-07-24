import type { Decision } from "@scw/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FileOutput, Scale } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useParams } from "react-router-dom";

import { Button } from "../components/Button";
import { DecisionSummary } from "../components/DecisionSummary";
import { SelectField, TextAreaField, TextField } from "../components/FormField";
import { InternalReviewPanel } from "../components/InternalReviewPanel";
import { PageHeader } from "../components/PageHeader";
import { ErrorState, LoadingState } from "../components/States";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../context/ToastContext";
import { useWorkspace } from "../context/WorkspaceContext";
import {
  generateAssessmentReport,
  recordApprovalDecision,
} from "../lib/api/actions";
import { loadAssessmentWorkspace } from "../lib/api/assessments";
import { hasCapability } from "../lib/access";
import { errorMessage } from "../lib/errors";
import { formatDate, titleCase } from "../lib/format";
import { formString } from "../lib/forms";

export function DecisionWorkspacePage() {
  const { assessmentId = "" } = useParams();
  const { membership, organization } = useWorkspace();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<Decision>("approved");
  const query = useQuery({
    queryKey: ["assessment-workspace", assessmentId],
    queryFn: () => loadAssessmentWorkspace(assessmentId),
    enabled: Boolean(assessmentId),
  });
  const mutation = useMutation({
    mutationFn: recordApprovalDecision,
    onSuccess: () => {
      notify("Approval decision recorded and supplier notified.", "success");
      void queryClient.invalidateQueries({
        queryKey: ["assessment-workspace", assessmentId],
      });
    },
    onError: (error) => notify(errorMessage(error), "error"),
  });
  const reportMutation = useMutation({
    mutationFn: generateAssessmentReport,
    onSuccess: () => notify("Updated assessment report queued.", "success"),
    onError: (error) => notify(errorMessage(error), "error"),
  });
  const canDecide =
    Boolean(membership) &&
    hasCapability(membership!.role, "decide_assessments");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const conditions = formString(form, "conditions").trim() || null;
    if (decision === "conditionally_approved" && !conditions) {
      notify("Conditional approval requires clear conditions.", "error");
      return;
    }
    mutation.mutate({
      assessmentId,
      conditions,
      decision,
      effectiveFrom: formString(form, "effectiveFrom"),
      internalRationale: formString(form, "internalRationale"),
      validUntil: formString(form, "validUntil") || null,
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
  const data = query.data;
  const unresolvedCritical = data.findings.filter(
    (finding) =>
      finding.severity === "critical" &&
      !["verified", "closed"].includes(finding.status),
  );

  return (
    <>
      <PageHeader
        eyebrow={`Decision · Version ${data.version.version_number}`}
        subtitle="Assess the complete qualification record before issuing an immutable outcome."
        title={data.program.name}
        actions={<StatusBadge value={data.assessment.status} />}
      />

      <div className="decision-layout">
        <div>
          <section className="section">
            <div className="section__header">
              <div>
                <h2>Decision readiness</h2>
                <p>Evidence, findings, and supplier declaration at a glance.</p>
              </div>
            </div>
            <dl className="detail-list detail-list--horizontal">
              <div>
                <dt>Completion</dt>
                <dd>{data.assessment.completeness_percentage}%</dd>
              </div>
              <div>
                <dt>Documents</dt>
                <dd>{data.documents.length}</dd>
              </div>
              <div>
                <dt>Open findings</dt>
                <dd>
                  {
                    data.findings.filter(
                      (finding) =>
                        !["verified", "closed"].includes(finding.status),
                    ).length
                  }
                </dd>
              </div>
              <div>
                <dt>Submitted</dt>
                <dd>{formatDate(data.assessment.submitted_at)}</dd>
              </div>
            </dl>
            {unresolvedCritical.length ? (
              <div className="validation-summary" role="alert">
                <AlertTriangle aria-hidden="true" size={18} />
                {unresolvedCritical.length} unresolved critical finding
                {unresolvedCritical.length === 1 ? "" : "s"} block a final
                decision.
              </div>
            ) : null}
          </section>

          <section className="section">
            <div className="section__header">
              <div>
                <h2>Finding disposition</h2>
                <p>All critical findings must be verified or closed.</p>
              </div>
            </div>
            <ul className="compact-list">
              {data.findings.map((finding) => (
                <li key={finding.id}>
                  <div>
                    <strong>
                      #{finding.finding_number} {finding.title}
                    </strong>
                    <span>{titleCase(finding.category)}</span>
                  </div>
                  <StatusBadge value={finding.severity} />
                  <StatusBadge value={finding.status} />
                </li>
              ))}
            </ul>
          </section>

          <section className="section">
            <div className="section__header">
              <div>
                <h2>Decision history</h2>
                <p>Recorded decisions remain historically visible.</p>
              </div>
              {data.decisions.length ? (
                <Button
                  busy={reportMutation.isPending}
                  onClick={() => reportMutation.mutate(assessmentId)}
                  tone="secondary"
                >
                  <FileOutput aria-hidden="true" size={16} />
                  Generate report
                </Button>
              ) : null}
            </div>
            <DecisionSummary
              decisions={data.decisions}
              organizationType={organization.organization_type}
            />
          </section>
        </div>

        <aside>
          <InternalReviewPanel
            organizationType={organization.organization_type}
            riskEvaluations={data.riskEvaluations}
          />
          {canDecide ? (
            <section className="section decision-form">
              <div className="section__header">
                <div>
                  <h2>Record outcome</h2>
                  <p>
                    The decision is audited and cannot be silently replaced.
                  </p>
                </div>
              </div>
              <form className="stack-form" onSubmit={submit}>
                <SelectField
                  label="Decision"
                  onChange={(event) =>
                    setDecision(event.target.value as Decision)
                  }
                  value={decision}
                >
                  <option value="approved">Approved</option>
                  <option value="conditionally_approved">
                    Conditionally approved
                  </option>
                  <option value="rejected">Rejected</option>
                  <option value="deferred">Deferred</option>
                </SelectField>
                <div className="form-grid">
                  <TextField
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    label="Effective from"
                    name="effectiveFrom"
                    required
                    type="date"
                  />
                  <TextField
                    label="Valid until"
                    name="validUntil"
                    type="date"
                  />
                </div>
                <TextAreaField
                  label="Supplier-visible conditions"
                  name="conditions"
                  required={decision === "conditionally_approved"}
                  rows={3}
                />
                <TextAreaField
                  hint="Buyer-only field protected from supplier sessions."
                  label="Internal rationale"
                  minLength={10}
                  name="internalRationale"
                  required
                  rows={4}
                />
                <Button
                  busy={mutation.isPending}
                  disabled={Boolean(unresolvedCritical.length)}
                  type="submit"
                >
                  <Scale aria-hidden="true" size={16} />
                  Record decision
                </Button>
              </form>
            </section>
          ) : null}
        </aside>
      </div>
    </>
  );
}

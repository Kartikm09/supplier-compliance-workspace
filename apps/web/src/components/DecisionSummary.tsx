import type { ApprovalDecision, OrganizationType } from "@scw/contracts";
import { CheckCircle2 } from "lucide-react";

import { formatDate, formatDateTime, titleCase } from "../lib/format";
import { EmptyState } from "./States";
import { StatusBadge } from "./StatusBadge";

export function DecisionSummary({
  decisions,
  organizationType,
}: {
  decisions: ApprovalDecision[];
  organizationType: OrganizationType;
}) {
  if (!decisions.length) {
    return (
      <EmptyState
        description="A buyer decision will appear after review requirements are satisfied."
        title="No decision recorded"
      />
    );
  }
  return (
    <ol className="decision-history">
      {decisions.map((decision) => (
        <li key={decision.id}>
          <CheckCircle2 aria-hidden="true" size={20} />
          <div>
            <div className="inline-heading">
              <strong>{titleCase(decision.decision)}</strong>
              <StatusBadge value={decision.decision} />
            </div>
            <p>
              Effective {formatDate(decision.effective_from)}
              {decision.valid_until
                ? ` through ${formatDate(decision.valid_until)}`
                : ""}
            </p>
            {decision.conditions ? <p>{decision.conditions}</p> : null}
            {organizationType === "buyer" && decision.internal_rationale ? (
              <div className="internal-note">
                <strong>Internal rationale</strong>
                <p>{decision.internal_rationale}</p>
              </div>
            ) : null}
            <small>Recorded {formatDateTime(decision.decided_at)}</small>
          </div>
        </li>
      ))}
    </ol>
  );
}

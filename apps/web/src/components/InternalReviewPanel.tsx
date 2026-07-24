import type { OrganizationType, RiskEvaluation } from "@scw/contracts";
import { LockKeyhole } from "lucide-react";

import { formatDateTime, titleCase } from "../lib/format";
import { EmptyState } from "./States";

export function InternalReviewPanel({
  internalNote,
  organizationType,
  riskEvaluations,
}: {
  internalNote?: string | null;
  organizationType: OrganizationType;
  riskEvaluations: RiskEvaluation[];
}) {
  if (organizationType !== "buyer") return null;
  const currentRisk = riskEvaluations[0];
  return (
    <section className="internal-panel" aria-label="Buyer internal review">
      <div className="internal-panel__heading">
        <LockKeyhole aria-hidden="true" size={18} />
        <div>
          <h3>Buyer internal review</h3>
          <p>Hidden from all supplier users by field-level database access.</p>
        </div>
      </div>
      {currentRisk ? (
        <dl className="detail-list detail-list--compact">
          <div>
            <dt>Risk level</dt>
            <dd>{titleCase(currentRisk.risk_level)}</dd>
          </div>
          <div>
            <dt>Total score</dt>
            <dd>{currentRisk.total_score}</dd>
          </div>
          <div>
            <dt>Calculation</dt>
            <dd>{currentRisk.calculation_version}</dd>
          </div>
          <div>
            <dt>Calculated</dt>
            <dd>{formatDateTime(currentRisk.calculated_at)}</dd>
          </div>
        </dl>
      ) : (
        <EmptyState
          description="Risk calculation has not completed for this assessment."
          title="No risk evaluation"
        />
      )}
      {internalNote ? (
        <div className="internal-note">
          <strong>Internal note</strong>
          <p>{internalNote}</p>
        </div>
      ) : null}
    </section>
  );
}

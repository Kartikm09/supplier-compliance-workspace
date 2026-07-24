import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, FileCheck2, ShieldAlert } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { Metric } from "../components/Metric";
import { PageHeader } from "../components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { StatusBadge } from "../components/StatusBadge";
import { useWorkspace } from "../context/WorkspaceContext";
import { loadRelationshipDetail } from "../lib/api/relationships";
import { errorMessage } from "../lib/errors";
import { formatDate, formatDateTime, titleCase } from "../lib/format";

export function RelationshipDetailPage() {
  const { relationshipId = "" } = useParams();
  const { organization } = useWorkspace();
  const query = useQuery({
    queryKey: ["relationship", relationshipId],
    queryFn: () => loadRelationshipDetail(relationshipId),
    enabled: Boolean(relationshipId),
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
  if (!query.data || !organization) return null;
  const { relationship, buyer, supplier } = query.data;
  const buyerView = organization.organization_type === "buyer";
  const counterpart = buyerView ? supplier : buyer;
  const openFindings = query.data.findings.filter(
    (finding) => !["verified", "closed"].includes(finding.status),
  );

  return (
    <>
      <PageHeader
        eyebrow={`${relationship.buyer_supplier_code} · ${titleCase(relationship.risk_tier)} risk`}
        subtitle={`${buyer.display_name} and ${supplier.display_name} qualification history and shared evidence.`}
        title={counterpart.display_name}
        actions={<StatusBadge value={relationship.relationship_status} />}
      />

      <section className="metric-grid metric-grid--three">
        <Metric
          icon={<ClipboardCheck size={20} />}
          label="Assessments"
          value={query.data.assessments.length}
        />
        <Metric
          icon={<ShieldAlert size={20} />}
          label="Open findings"
          value={openFindings.length}
        />
        <Metric
          icon={<FileCheck2 size={20} />}
          label="Evidence records"
          value={query.data.documents.length}
        />
      </section>

      <div className="detail-grid">
        <section className="section">
          <div className="section__header">
            <div>
              <h2>Relationship details</h2>
              <p>Shared context visible to both parties.</p>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Buyer</dt>
              <dd>{buyer.legal_name}</dd>
            </div>
            <div>
              <dt>Supplier</dt>
              <dd>{supplier.legal_name}</dd>
            </div>
            <div>
              <dt>Onboarding</dt>
              <dd>
                <StatusBadge value={relationship.onboarding_status} />
              </dd>
            </div>
            <div>
              <dt>Accepted</dt>
              <dd>{formatDate(relationship.accepted_at)}</dd>
            </div>
            <div>
              <dt>Country</dt>
              <dd>{counterpart.country_code ?? "Not provided"}</dd>
            </div>
            {buyerView ? (
              <div>
                <dt>Risk tier</dt>
                <dd>{titleCase(relationship.risk_tier)}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="section">
          <div className="section__header">
            <div>
              <h2>Supplier profile</h2>
              <p>Organization-level qualification context.</p>
            </div>
          </div>
          {query.data.supplierProfile ? (
            <dl className="detail-list">
              <div>
                <dt>Headquarters</dt>
                <dd>
                  {query.data.supplierProfile.headquarters_country ??
                    "Not provided"}
                </dd>
              </div>
              <div>
                <dt>Employee range</dt>
                <dd>
                  {query.data.supplierProfile.employee_range ?? "Not provided"}
                </dd>
              </div>
              <div>
                <dt>Profile status</dt>
                <dd>
                  <StatusBadge
                    value={query.data.supplierProfile.profile_status}
                  />
                </dd>
              </div>
              <div>
                <dt>Website</dt>
                <dd>{query.data.supplierProfile.website ?? "Not provided"}</dd>
              </div>
            </dl>
          ) : (
            <EmptyState
              description="The supplier has not completed its organization profile."
              title="Profile incomplete"
            />
          )}
        </section>
      </div>

      <section className="section section--flush">
        <div className="section__header section__header--padded">
          <div>
            <h2>Qualification history</h2>
            <p>
              Each assessment remains fixed to its original program version.
            </p>
          </div>
        </div>
        {query.data.assessments.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Assessment</th>
                  <th scope="col">Version</th>
                  <th scope="col">Completion</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last updated</th>
                </tr>
              </thead>
              <tbody>
                {query.data.assessments.map((assessment) => (
                  <tr key={assessment.id}>
                    <td>
                      <Link
                        className="table-link"
                        to={
                          buyerView
                            ? `/reviews/${assessment.id}`
                            : `/assessments/${assessment.id}`
                        }
                      >
                        {assessment.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td>{assessment.program_version_id.slice(0, 8)}</td>
                    <td>{assessment.completeness_percentage}%</td>
                    <td>
                      <StatusBadge value={assessment.status} />
                    </td>
                    <td>{formatDateTime(assessment.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            description="No qualification assessment has been started for this relationship."
            title="No assessment history"
          />
        )}
      </section>

      {query.data.approvals.length ? (
        <section className="section">
          <div className="section__header">
            <div>
              <h2>Decision history</h2>
              <p>Immutable buyer decisions and validity periods.</p>
            </div>
          </div>
          <ul className="timeline">
            {query.data.approvals.map((decision) => (
              <li key={decision.id}>
                <span aria-hidden="true" />
                <div>
                  <strong>{titleCase(decision.decision)}</strong>
                  <p>
                    Effective {formatDate(decision.effective_from)}
                    {decision.valid_until
                      ? ` through ${formatDate(decision.valid_until)}`
                      : ""}
                  </p>
                  {decision.conditions ? <p>{decision.conditions}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

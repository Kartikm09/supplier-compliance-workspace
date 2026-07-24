import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  ClipboardCheck,
  FileWarning,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Metric } from "../components/Metric";
import { PageHeader } from "../components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { StatusBadge } from "../components/StatusBadge";
import { useWorkspace } from "../context/WorkspaceContext";
import { loadDashboard } from "../lib/api/relationships";
import { errorMessage } from "../lib/errors";
import { formatDateTime, relativeDeadline } from "../lib/format";

export function DashboardPage() {
  const { organization } = useWorkspace();
  const query = useQuery({
    queryKey: ["dashboard", organization?.id],
    queryFn: () =>
      loadDashboard(organization!.id, organization!.organization_type),
    enabled: Boolean(organization),
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
  if (!organization || !query.data) return null;
  const buyer = organization.organization_type === "buyer";
  const { metrics } = query.data;

  return (
    <>
      <PageHeader
        eyebrow={buyer ? "Buyer operations" : "Supplier operations"}
        subtitle={
          buyer
            ? "Qualification workload, supplier risk, and evidence deadlines in one view."
            : "Your active buyer relationships, submissions, findings, and document deadlines."
        }
        title={`Good to see you, ${organization.display_name}`}
        actions={
          <Link
            className="button button--primary"
            to={buyer ? "/relationships" : "/assessments"}
          >
            {buyer ? "Review suppliers" : "Continue assessment"}
          </Link>
        }
      />

      <section className="metric-grid" aria-label="Workspace summary">
        <Metric
          detail="Current active relationships"
          icon={<Building2 size={20} />}
          label={buyer ? "Active suppliers" : "Active buyers"}
          value={metrics.activeRelationships}
        />
        <Metric
          detail={buyer ? "Submitted for review" : "Draft or changes requested"}
          icon={<ClipboardCheck size={20} />}
          label="Assessments needing action"
          value={metrics.assessmentsAwaitingAction}
        />
        <Metric
          detail="Within the next 60 days"
          icon={<FileWarning size={20} />}
          label="Documents expiring"
          value={metrics.documentsExpiringSoon}
        />
        <Metric
          detail={`${metrics.overdueActions} overdue`}
          icon={<AlertTriangle size={20} />}
          label="Open findings"
          value={metrics.openFindings}
        />
      </section>

      <div className="dashboard-grid">
        <section className="section">
          <div className="section__header">
            <div>
              <h2>Assessment activity</h2>
              <p>Most recently updated qualification work.</p>
            </div>
            <Link to={buyer ? "/reviews" : "/assessments"}>View all</Link>
          </div>
          {query.data.recentAssessments.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Assessment</th>
                    <th scope="col">Progress</th>
                    <th scope="col">Status</th>
                    <th scope="col">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.recentAssessments.map((assessment) => (
                    <tr key={assessment.id}>
                      <td>
                        <Link
                          className="table-link"
                          to={
                            buyer
                              ? `/reviews/${assessment.id}`
                              : `/assessments/${assessment.id}`
                          }
                        >
                          Qualification {assessment.id.slice(0, 8)}
                        </Link>
                      </td>
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
              description="Assessment activity appears here after a buyer starts a supplier qualification."
              title="No assessments yet"
            />
          )}
        </section>

        <section className="section">
          <div className="section__header">
            <div>
              <h2>Findings requiring attention</h2>
              <p>Open review issues ordered by recent activity.</p>
            </div>
            {!buyer ? <Link to="/findings">View all</Link> : null}
          </div>
          {query.data.recentFindings.length ? (
            <ul className="activity-list">
              {query.data.recentFindings.map((finding) => (
                <li key={finding.id}>
                  <span
                    className={`severity-dot severity-dot--${finding.severity}`}
                    aria-hidden="true"
                  />
                  <div>
                    <Link
                      to={
                        buyer
                          ? `/reviews/${finding.assessment_id}#finding-${finding.id}`
                          : `/findings/${finding.id}`
                      }
                    >
                      {finding.title}
                    </Link>
                    <span>
                      #{finding.finding_number} ·{" "}
                      {relativeDeadline(finding.due_at)}
                    </span>
                  </div>
                  <StatusBadge value={finding.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              description="No unresolved findings are visible for this organization."
              title="No open findings"
            />
          )}
        </section>
      </div>

      <section className="section operational-strip">
        <div>
          <CalendarClock aria-hidden="true" size={21} />
          <div>
            <h2>Deadline signal</h2>
            <p>
              {metrics.overdueActions
                ? `${metrics.overdueActions} corrective action${metrics.overdueActions === 1 ? " is" : "s are"} past due.`
                : "No corrective actions are currently overdue."}
            </p>
          </div>
        </div>
        <Link to={buyer ? "/reviews" : "/findings"}>Open action queue</Link>
      </section>
    </>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";

export interface ReviewCase {
  id: string;
  tenant: string;
  title: string;
  status: "draft" | "submitted" | "approved";
  version: number;
  evidence: string;
  private_note?: string;
  assessment: string;
}

export type Api = <T>(
  path: string,
  identity: string,
  options?: RequestInit,
) => Promise<T>;
export const request: Api = async <T,>(
  path: string,
  identity: string,
  options?: RequestInit,
) => {
  const response = await fetch(`/reviewer-api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer fixture-${identity}`,
    },
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    const detail =
      typeof data === "object" && data !== null && "detail" in data
        ? data.detail
        : null;
    throw new Error(
      typeof detail === "string"
        ? detail
        : "Invalid assessment. Check the fields and try again.",
    );
  }
  return data as T;
};

// Index the returned list once. Search and selection rerenders reuse its IDs
// instead of scanning the list again to resolve the active case.
export function indexEvidence<T extends { id: string }>(
  records: readonly T[],
): Map<string, T> {
  const index = new Map<string, T>();
  for (const record of records) {
    const id = record.id;
    if (!index.has(id)) index.set(id, record);
  }
  return index;
}

function EvidencePanel({
  id,
  identity,
  api,
  changed,
}: {
  id: string;
  identity: string;
  api: Api;
  changed: () => void;
}) {
  const [record, setRecord] = useState<ReviewCase | null>(null);
  const [assessment, setAssessment] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let active = true;
    const abort = new AbortController();
    setLoading(true);
    setError("");
    void api<ReviewCase>(`/cases/${id}`, identity, { signal: abort.signal })
      .then((data) => {
        if (active) {
          setRecord(data);
          setAssessment(data.assessment);
        }
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "The request could not be completed.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      abort.abort();
    };
  }, [id, identity, api, retry]);

  const mutate = async (action: "submit" | "approve") => {
    if (!record) return;
    if (!assessment.trim()) {
      setError("A written evidence assessment is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const data = await api<ReviewCase>(`/cases/${id}/transitions`, identity, {
        method: "POST",
        body: JSON.stringify({ action, version: record.version, assessment }),
      });
      setRecord(data);
      changed();
      heading.current?.focus();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The request could not be completed.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <section aria-label="Evidence panel" aria-busy="true">
        <p role="status">Loading evidence…</p>
      </section>
    );
  if (!record)
    return (
      <section aria-label="Evidence panel">
        <p role="alert">{error || "No case selected."}</p>
        <button onClick={() => setRetry(retry + 1)}>Retry loading</button>
      </section>
    );
  const contributor = identity === "apex-contributor";
  const reviewer = identity.endsWith("reviewer");
  return (
    <section aria-label="Evidence panel">
      <p className="lab-eyebrow">Evidence · version {record.version}</p>
      <h2 ref={heading} tabIndex={-1}>
        {record.title}
      </h2>
      <p aria-live="polite">
        Status: <strong data-testid="case-status">{record.status}</strong>
      </p>
      <blockquote>{record.evidence}</blockquote>
      {record.private_note ? (
        <aside>
          <h3>Private reviewer note</h3>
          <p>{record.private_note}</p>
        </aside>
      ) : null}
      <label htmlFor="assessment">Written evidence assessment</label>
      <textarea
        id="assessment"
        maxLength={2000}
        rows={5}
        value={assessment}
        onChange={(event) => setAssessment(event.target.value)}
        aria-describedby="assessment-help"
      />
      <p id="assessment-help">
        Use this fictional evidence only. An assessment is required before a
        transition.
      </p>
      {error ? (
        <p role="alert">
          {error}{" "}
          <button onClick={() => setRetry(retry + 1)}>Reload evidence</button>
        </p>
      ) : null}
      <div className="lab-actions">
        {record.status === "draft" && contributor ? (
          <button disabled={saving} onClick={() => void mutate("submit")}>
            {saving ? "Submitting…" : "Submit assessment"}
          </button>
        ) : null}
        {record.status === "submitted" && reviewer ? (
          <button disabled={saving} onClick={() => void mutate("approve")}>
            {saving ? "Approving…" : "Approve assessment"}
          </button>
        ) : null}
        {!contributor && !reviewer ? (
          <p>
            Read-only role. Review transitions require an authorized contributor
            or reviewer.
          </p>
        ) : null}
        {record.status === "approved" ? (
          <p role="status">
            Assessment approved. The evidence and assessment remain inspectable.
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function ReviewerLab({ api = request }: { api?: Api }) {
  const [identity, setIdentity] = useState("apex-contributor");
  const [cases, setCases] = useState<ReviewCase[]>([]);
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    const abort = new AbortController();
    setLoading(true);
    setError("");
    void api<ReviewCase[]>("/cases", identity, { signal: abort.signal })
      .then((data) => {
        if (active) {
          setCases(data);
          setSelected((value) =>
            data.some((item) => item.id === value)
              ? value
              : (data[0]?.id ?? ""),
          );
        }
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "The request could not be completed.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      abort.abort();
    };
  }, [identity, api, revision]);
  const index = useMemo(() => indexEvidence(cases), [cases]);
  const visible = useMemo(
    () =>
      cases.filter((item) =>
        item.title.toLowerCase().includes(search.toLowerCase().trim()),
      ),
    [cases, search],
  );
  const activeId = index.has(selected) ? selected : "";
  return (
    <main className="reviewer-lab">
      <header>
        <p className="lab-eyebrow">
          Supplier Compliance Workspace · local laboratory
        </p>
        <h1>Evidence review</h1>
        <p>
          Two fictional tenants. Real local API authorization. Fixture
          identities are public test selectors and must never be deployed as
          authentication.
        </p>
      </header>
      <div className="lab-toolbar">
        <label>
          Fixture identity
          <select
            value={identity}
            onChange={(event) => {
              setIdentity(event.target.value);
              setCases([]);
              setSelected("");
            }}
          >
            <option value="apex-contributor">Apex contributor</option>
            <option value="apex-reviewer">Apex reviewer</option>
            <option value="apex-viewer">Apex read-only</option>
            <option value="greenline-reviewer">Greenline reviewer</option>
          </select>
        </label>
        <label>
          Search cases
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>
      {error ? (
        <p role="alert">
          {error}{" "}
          <button onClick={() => setRevision(revision + 1)}>Retry cases</button>
        </p>
      ) : null}
      <div className="lab-grid">
        <nav aria-label="Review cases">
          <h2>Cases</h2>
          {loading ? (
            <p role="status">Loading cases…</p>
          ) : visible.length ? (
            <ul>
              {visible.map((item) => (
                <li key={item.id}>
                  <button
                    aria-current={item.id === activeId ? "true" : undefined}
                    aria-label={`${item.title} ${item.status}`}
                    onClick={() => setSelected(item.id)}
                  >
                    {item.title}
                    <small>{item.status}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>No cases match your search.</p>
          )}
        </nav>
        {activeId ? (
          <EvidencePanel
            key={`${identity}:${activeId}`}
            id={activeId}
            identity={identity}
            api={api}
            changed={() => setRevision((value) => value + 1)}
          />
        ) : (
          <section>
            <h2>Case evidence</h2>
            <p>Select an available case.</p>
          </section>
        )}
      </div>
      <footer>
        Fixture clock: 18 September 2026, 09:00 UTC. All organizations, evidence
        and decisions are synthetic.
      </footer>
    </main>
  );
}

import type { DocumentVersion } from "@scw/contracts";
import { Download, FileText } from "lucide-react";

import { formatBytes, formatDate, formatDateTime } from "../lib/format";
import { Button } from "./Button";
import { EmptyState } from "./States";
import { StatusBadge } from "./StatusBadge";

export function DocumentVersionList({
  busyVersionId,
  onOpen,
  versions,
}: {
  busyVersionId?: string | null;
  onOpen: (version: DocumentVersion) => void;
  versions: DocumentVersion[];
}) {
  if (!versions.length) {
    return (
      <EmptyState
        description="A successful private upload creates the first version."
        title="No versions uploaded"
      />
    );
  }
  return (
    <ol className="version-list">
      {versions.map((version) => (
        <li key={version.id}>
          <div className="version-list__icon" aria-hidden="true">
            <FileText size={19} />
          </div>
          <div className="version-list__main">
            <div>
              <strong>Version {version.version_number}</strong>
              <StatusBadge value={version.upload_status} />
            </div>
            <span>{version.original_filename}</span>
            <small>
              {formatBytes(version.byte_size)} · Uploaded{" "}
              {formatDateTime(version.uploaded_at)}
            </small>
          </div>
          <dl className="version-list__dates">
            <div>
              <dt>Issue</dt>
              <dd>{formatDate(version.issue_date)}</dd>
            </div>
            <div>
              <dt>Expiry</dt>
              <dd>{formatDate(version.expiry_date)}</dd>
            </div>
          </dl>
          <Button
            aria-label={`Open version ${version.version_number}`}
            busy={busyVersionId === version.id}
            disabled={version.upload_status !== "ready"}
            onClick={() => onOpen(version)}
            tone="quiet"
          >
            <Download aria-hidden="true" size={17} />
          </Button>
        </li>
      ))}
    </ol>
  );
}

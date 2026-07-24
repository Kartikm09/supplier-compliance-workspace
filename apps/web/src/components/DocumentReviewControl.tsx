import type { DocumentReview, DocumentVersion } from "@scw/contracts";
import { type FormEvent, useRef } from "react";

import { Button } from "./Button";
import { formString } from "../lib/forms";

export function DocumentReviewControl({
  busy,
  currentReview,
  onReview,
  version,
}: {
  busy: boolean;
  currentReview?: DocumentReview | undefined;
  onReview: (values: {
    internalNote: string | null;
    reviewerNote: string | null;
    status: DocumentReview["status"];
  }) => void;
  version: DocumentVersion;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  const submit = (status: DocumentReview["status"]) => {
    if (!formRef.current) return;
    const form = new FormData(formRef.current);
    onReview({
      internalNote: formString(form, "internalNote").trim() || null,
      reviewerNote: formString(form, "reviewerNote").trim() || null,
      status,
    });
  };
  return (
    <form
      className="document-review"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        submit("accepted");
      }}
      ref={formRef}
    >
      <label className="field">
        <span className="field__label">Supplier-visible review note</span>
        <textarea
          defaultValue={currentReview?.reviewer_note ?? ""}
          name="reviewerNote"
          rows={2}
        />
      </label>
      <label className="field field--internal">
        <span className="field__label">Buyer internal note</span>
        <textarea
          defaultValue={currentReview?.internal_note ?? ""}
          name="internalNote"
          rows={2}
        />
      </label>
      <div className="button-row">
        <Button busy={busy} type="submit">
          Accept version {version.version_number}
        </Button>
        <Button
          busy={busy}
          onClick={() => submit("replacement_requested")}
          tone="danger"
          type="button"
        >
          Request replacement
        </Button>
      </div>
    </form>
  );
}

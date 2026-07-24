import { AlertTriangle, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

import { Button } from "./Button";

export function ConfirmDialog({
  busy = false,
  confirmLabel,
  description,
  onCancel,
  onConfirm,
  open,
  title,
  tone = "primary",
}: {
  busy?: boolean;
  confirmLabel: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
  tone?: "primary" | "danger";
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      aria-labelledby={titleId}
      className="dialog"
      onCancel={onCancel}
      ref={dialogRef}
    >
      <div className="dialog__header">
        <AlertTriangle aria-hidden="true" size={20} />
        <h2 id={titleId}>{title}</h2>
        <button
          aria-label="Close dialog"
          className="icon-button"
          onClick={onCancel}
          type="button"
        >
          <X aria-hidden="true" size={17} />
        </button>
      </div>
      <p>{description}</p>
      <div className="dialog__actions">
        <Button tone="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button busy={busy} tone={tone} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}

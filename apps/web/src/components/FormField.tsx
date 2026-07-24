import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useId } from "react";

interface FieldProps {
  error?: string | undefined;
  hint?: string | undefined;
  label: string;
  required?: boolean | undefined;
}

function FieldFrame({
  children,
  error,
  hint,
  id,
  label,
  required,
}: FieldProps & { children: ReactNode; id: string }) {
  const descriptionId = hint || error ? `${id}-description` : undefined;
  return (
    <label className="field" htmlFor={id}>
      <span className="field__label">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </span>
      {children}
      {descriptionId ? (
        <span
          className={`field__help ${error ? "field__help--error" : ""}`}
          id={descriptionId}
        >
          {error ?? hint}
        </span>
      ) : null}
    </label>
  );
}

export function TextField({
  error,
  hint,
  label,
  required,
  ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  return (
    <FieldFrame
      error={error}
      hint={hint}
      id={id}
      label={label}
      required={required}
    >
      <input
        aria-describedby={hint || error ? `${id}-description` : undefined}
        aria-invalid={Boolean(error)}
        id={id}
        required={required}
        {...props}
      />
    </FieldFrame>
  );
}

export function TextAreaField({
  error,
  hint,
  label,
  required,
  ...props
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  return (
    <FieldFrame
      error={error}
      hint={hint}
      id={id}
      label={label}
      required={required}
    >
      <textarea
        aria-describedby={hint || error ? `${id}-description` : undefined}
        aria-invalid={Boolean(error)}
        id={id}
        required={required}
        {...props}
      />
    </FieldFrame>
  );
}

export function SelectField({
  children,
  error,
  hint,
  label,
  required,
  ...props
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  return (
    <FieldFrame
      error={error}
      hint={hint}
      id={id}
      label={label}
      required={required}
    >
      <select
        aria-describedby={hint || error ? `${id}-description` : undefined}
        aria-invalid={Boolean(error)}
        id={id}
        required={required}
        {...props}
      >
        {children}
      </select>
    </FieldFrame>
  );
}

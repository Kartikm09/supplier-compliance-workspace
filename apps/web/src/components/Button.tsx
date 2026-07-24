import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  busy?: boolean;
  children: ReactNode;
  tone?: "primary" | "secondary" | "danger" | "quiet";
}

export function Button({
  busy = false,
  children,
  className = "",
  disabled,
  tone = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`button button--${tone} ${className}`}
      disabled={disabled || busy}
      {...props}
    >
      {busy ? <span className="button__spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

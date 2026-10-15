// A sample component from the (pretend) design system —
// the one intentionally "designed" element on the page.
// Treat it like a library primitive: compose it or reuse the pattern.
// Not where the exercise problems live; extend it if you have a reason to.
import type { ReactNode } from "react";

type CardProps = {
  label: string;
  value: ReactNode;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
};

export function Card({ label, value, onClick, selected, disabled }: CardProps) {
  const className = [
    "card",
    onClick ? "card-button" : "",
    selected ? "card-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (onClick) {
    return (
      <button
        aria-pressed={selected}
        className={className}
        disabled={disabled}
        onClick={onClick}
        type="button"
      >
        <div className="card-value">{value}</div>
        <div className="card-label">{label}</div>
      </button>
    );
  }

  return (
    <div className={className}>
      <div className="card-value">{value}</div>
      <div className="card-label">{label}</div>
    </div>
  );
}

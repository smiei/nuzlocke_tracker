import type { ReactNode } from "react";
import { cn } from "./cn";

// Semantic pill. Before this the same badge existed in three sizes, and
// "success" was emerald in some files and green in others.
type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const TONES: Record<Tone, string> = {
  neutral: "border-line bg-sunken text-ink-muted",
  success: "border-success-line bg-success-bg text-success",
  warning: "border-warning-line bg-warning-bg text-warning",
  danger: "border-danger-line bg-danger-bg text-danger",
  info: "border-info-line bg-info-bg text-info",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

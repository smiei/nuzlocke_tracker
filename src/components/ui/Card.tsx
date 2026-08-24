import type { HTMLAttributes } from "react";
import { cn } from "./cn";

// One surface, replacing 52 distinct card-like class strings. `bg-panel` is
// what makes cards readable in dark mode: previously they were transparent on
// the page background, so nothing separated a card from the page.
type Padding = "none" | "sm" | "md";

const PADDING: Record<Padding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
};

export function Card({
  padding = "md",
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { padding?: Padding }) {
  return (
    <div
      className={cn("rounded-lg border border-line bg-panel", PADDING[padding], className)}
      {...rest}
    >
      {children}
    </div>
  );
}

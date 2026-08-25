import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import { Spinner } from "./Spinner";

// Replaces 69 distinct hand-rolled button class signatures across 90 buttons.
// Everything a button can be is a prop here; a call site that needs its own
// colours is a sign the variant list is missing one, not a licence to inline.
//
// Sizes follow the touch-target policy: `md` is 44px (Apple HIG's minimum, used
// for primary and destructive actions), `sm` is 40px and is the floor. The app
// previously ran on ~24px buttons, which is where most of the mis-taps came
// from.
type Variant = "primary" | "secondary" | "success" | "danger" | "danger-solid" | "ghost";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:opacity-90",
  secondary: "border border-line-strong text-ink-muted hover:bg-hover hover:text-ink",
  // Symmetric with `danger`: an outline in the semantic colour, filling in on
  // hover. "Add to team", "evolve" and the quick-catch confirm all had this
  // exact string inline.
  success: "border border-success-line text-success hover:bg-success-bg",
  danger: "border border-danger-line text-danger hover:bg-danger-bg",
  // The destructive counterpart of `primary`: for the one button that carries
  // out the deletion, not for every button that could lead to one.
  "danger-solid": "bg-danger-solid text-danger-solid-ink hover:opacity-90",
  ghost: "text-ink-muted hover:bg-hover hover:text-ink",
};

const SIZES: Record<Size, string> = {
  sm: "h-10 px-3 text-sm",
  md: "h-11 px-4 text-sm",
};

const ICON_SIZES: Record<Size, string> = {
  sm: "h-10 w-10",
  md: "h-11 w-11",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  // Swaps the icon slot for a spinner and disables the button. Every mutation
  // in this app crosses a Cloudflare tunnel, so silence here reads as a freeze.
  loading?: boolean;
  icon?: ReactNode;
  // Square, label-less. `aria-label` becomes mandatory in that case.
  iconOnly?: boolean;
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  icon,
  iconOnly = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        iconOnly ? ICON_SIZES[size] : SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {!iconOnly && children}
    </button>
  );
}

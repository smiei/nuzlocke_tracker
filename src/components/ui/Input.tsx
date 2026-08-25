import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

// 12 input variants and 7 select variants existed before, and they disagreed
// with each other about their own dark background (`dark:bg-zinc-900` vs
// `dark:bg-zinc-950`). One shell each, 44px tall for touch.
const FIELD =
  "w-full rounded-md border border-line-strong bg-panel px-3 text-sm text-ink placeholder:text-ink-subtle disabled:cursor-not-allowed disabled:opacity-50";

// Same vocabulary as Button: `md` is the 44px default, `sm` the 40px floor for
// dense inline rows. It has to be a prop rather than a className override,
// because `cn` is a plain join and cannot drop the built-in height.
// The DOM `size` attribute (a number on both input and select) is shadowed
// deliberately - it is not used anywhere in this app.
type Size = "sm" | "md";
const HEIGHTS: Record<Size, string> = { sm: "h-10", md: "h-11" };

export function Input({
  size = "md",
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & { size?: Size }) {
  return <input className={cn(FIELD, HEIGHTS[size], className)} {...rest} />;
}

export function Select({
  size = "md",
  className,
  children,
  ...rest
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & { size?: Size }) {
  return (
    <select className={cn(FIELD, HEIGHTS[size], className)} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(FIELD, "py-2", className)} {...rest} />;
}

// The label that sits above a field. Was duplicated verbatim in 4 files plus
// once more as a local const.
export function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-ink-muted">
      {children}
    </label>
  );
}

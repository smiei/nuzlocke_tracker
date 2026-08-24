import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

// 12 input variants and 7 select variants existed before, and they disagreed
// with each other about their own dark background (`dark:bg-zinc-900` vs
// `dark:bg-zinc-950`). One shell each, 44px tall for touch.
const FIELD =
  "w-full rounded-md border border-line-strong bg-panel px-3 text-sm text-ink placeholder:text-ink-subtle disabled:cursor-not-allowed disabled:opacity-50";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD, "h-11", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(FIELD, "h-11", className)} {...rest}>
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

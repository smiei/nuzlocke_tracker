// Joins class names, dropping falsy entries. Deliberately tiny - the project
// keeps its dependency list short, and this is all the primitives need.
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

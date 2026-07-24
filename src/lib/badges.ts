// Matches slug() in scripts/download-badges.mjs - the filename each badge's
// icon is downloaded/cropped to under public/badges/<slug>.png.
export function badgeSlug(nameEn: string): string {
  return nameEn
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

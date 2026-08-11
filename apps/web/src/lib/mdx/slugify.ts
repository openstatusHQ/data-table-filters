/**
 * Heading text to anchor id. Lives apart from `get-content` because that module
 * reads the filesystem, and this one is needed on the client too.
 */
export function slugify(str: string) {
  return str
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/&/g, "-and-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-");
}

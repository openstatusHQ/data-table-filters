import type { ReactElement, ReactNode } from "react";

/**
 * The readable text of a heading's rendered children.
 *
 * `String(children)` looks like it does this and does not: a heading such as
 * ``## The `query_table` Tool`` arrives as an array holding a `<code>` element,
 * which stringifies to `[object Object]`. Ids built that way collide with each
 * other and never match the anchors the table of contents and the docs search
 * derive from the markdown source.
 */
export function headingText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(headingText).join("");
  }

  if (typeof node === "object" && "props" in node) {
    const { children } = (node as ReactElement<{ children?: ReactNode }>).props;
    return headingText(children);
  }

  return "";
}

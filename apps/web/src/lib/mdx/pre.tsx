import React from "react";
import { CopyButton } from "./copy-button";

function extractTextFromReactNode(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractTextFromReactNode).join("");
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    if (props.children) return extractTextFromReactNode(props.children);
  }
  return "";
}

export function Pre({ children, ...props }: React.ComponentProps<"pre">) {
  const text = extractTextFromReactNode(children);
  return (
    <div className="relative">
      <pre {...props}>{children}</pre>
      <CopyButton text={text} />
    </div>
  );
}

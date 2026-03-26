"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

function highlight(root: HTMLElement, query: string) {
  if (!query) return;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);

  const textNodes: Text[] = [];
  let node = walker.nextNode();

  while (node) {
    if (node instanceof Text) {
      textNodes.push(node);
    }
    node = walker.nextNode();
  }

  for (const textNode of textNodes) {
    const nodeValue = textNode.nodeValue;
    if (!nodeValue || !regex.test(nodeValue)) continue;
    regex.lastIndex = 0;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(nodeValue)) !== null) {
      if (match.index > lastIndex) {
        fragment.appendChild(
          document.createTextNode(nodeValue.slice(lastIndex, match.index)),
        );
      }
      const mark = document.createElement("mark");
      mark.textContent = match[1];
      fragment.appendChild(mark);
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < nodeValue.length) {
      fragment.appendChild(document.createTextNode(nodeValue.slice(lastIndex)));
    }

    textNode.parentNode?.replaceChild(fragment, textNode);
  }
}

function HighlightTextInner({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const q = searchParams.get("q");

  useEffect(() => {
    if (ref.current && q) {
      highlight(ref.current, q);
    }
  }, [q]);

  return <div ref={ref}>{children}</div>;
}

export function HighlightText({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={children}>
      <HighlightTextInner>{children}</HighlightTextInner>
    </Suspense>
  );
}

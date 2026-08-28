import { useLocalStorage } from "@dtf/registry/hooks/use-local-storage";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Renders a component once, without running effects — the same thing the server
 * does, and the same thing the client does on its hydration render.
 */
function renderOnce<T>(key: string, initialValue: T) {
  function Probe() {
    const [value] = useLocalStorage(key, initialValue);
    return createElement("span", null, JSON.stringify(value));
  }
  return renderToStaticMarkup(createElement(Probe));
}

function stubLocalStorage(entries: Record<string, string>) {
  const store = new Map(Object.entries(entries));
  // Minimal browser stub: the hook only ever calls getItem/setItem.
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useLocalStorage", () => {
  it("returns the initial value on the first render even when a value is stored", () => {
    // Regression: reading localStorage during render made the first client
    // render differ from the server HTML, which broke hydration.
    stubLocalStorage({ "last-searches": JSON.stringify(["stored"]) });

    expect(renderOnce("last-searches", [] as string[])).toBe("<span>[]</span>");
  });

  it("renders the same markup with and without a browser environment", () => {
    const server = renderOnce("last-searches", [] as string[]);
    stubLocalStorage({ "last-searches": JSON.stringify(["stored"]) });
    const client = renderOnce("last-searches", [] as string[]);

    expect(client).toBe(server);
  });

  it("falls back to the initial value when nothing is stored", () => {
    stubLocalStorage({});

    expect(renderOnce("column-order", ["id"])).toBe(
      "<span>[&quot;id&quot;]</span>",
    );
  });
});

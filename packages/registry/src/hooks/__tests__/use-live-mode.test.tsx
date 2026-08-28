// @vitest-environment jsdom

import { useLiveMode } from "@dtf/registry/hooks/use-live-mode";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression: the captured timestamp has to be visible to the render that
 * reacts to the toggle.
 *
 * It is read during render — `getRowClassName` dims every row older than it —
 * but it used to be written to a ref from an effect, so the render triggered by
 * the toggle still saw the previous value and no render followed. Turning live
 * mode off triggers no refetch of its own (`live` is not part of the query
 * key), so nothing rebuilt the rows and they stayed dimmed.
 */

const live = { current: false };

vi.mock("@dtf/registry/lib/store/hooks/useFilterState", () => ({
  useFilterState: (selector: (state: { live: boolean }) => unknown) =>
    selector({ live: live.current }),
}));

type Item = { date: Date };

const NOW = 1_700_000_000_000;

// Two rows, both older than any timestamp the hook can capture.
const data: Item[] = [
  { date: new Date(NOW - 2000) },
  { date: new Date(NOW - 1000) },
];

let container: HTMLDivElement;
let root: Root;
let results: ReturnType<typeof useLiveMode<Item>>[];

function Probe() {
  results.push(useLiveMode(data));
  return null;
}

function render() {
  act(() => root.render(<Probe />));
}

function latest() {
  const result = results.at(-1);
  if (!result) throw new Error("Probe did not render");
  return result;
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
  results = [];
  live.current = false;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("useLiveMode", () => {
  it("has no timestamp while live mode is off", () => {
    render();

    expect(latest().timestamp).toBeUndefined();
    expect(latest().row).toBeUndefined();
  });

  it("captures a timestamp when live mode is turned on", () => {
    render();

    live.current = true;
    render();

    expect(latest().timestamp).toBe(NOW);
    // Every row predates the capture, so the first one anchors the live row.
    expect(latest().row).toBe(data[0]);
  });

  it("keeps the captured timestamp across unrelated re-renders", () => {
    live.current = true;
    render();
    const captured = latest().timestamp;

    vi.setSystemTime(NOW + 5000);
    render();

    // Only a toggle re-captures; a data fetch or a resize must not move the
    // line that decides which rows are dimmed.
    expect(latest().timestamp).toBe(captured);
  });

  it("clears the timestamp in the render that reacts to switching off", () => {
    live.current = true;
    render();
    expect(latest().timestamp).toBe(NOW);

    live.current = false;
    render();

    expect(latest().timestamp).toBeUndefined();
    expect(latest().row).toBeUndefined();
  });
});

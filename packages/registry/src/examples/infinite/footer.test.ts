// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { formatShortcut, SHORTCUTS, triggerShortcut } from "./footer";

/**
 * `useHotKey` listens on `window` and only fires with `⌘`/`Ctrl` held — for
 * every key, `Escape` included. A replay that drops the modifier would look
 * right in the menu and do nothing.
 */
const onKeyDown = vi.fn((event: KeyboardEvent) => event);

afterEach(() => {
  window.removeEventListener("keydown", onKeyDown);
  onKeyDown.mockClear();
});

describe("triggerShortcut", () => {
  it.each(SHORTCUTS.map((s) => s.key))(
    "replays %s as a meta keydown that reaches window",
    (key) => {
      window.addEventListener("keydown", onKeyDown);

      triggerShortcut(key);

      expect(onKeyDown).toHaveBeenCalledTimes(1);
      const event = onKeyDown.mock.calls[0][0];
      expect(event.key).toBe(key);
      expect(event.metaKey).toBe(true);
      expect(event.shiftKey).toBe(false);
    },
  );
});

describe("formatShortcut", () => {
  it("renders every shortcut as a ⌘ chord, with Escape shortened", () => {
    expect(formatShortcut("k")).toBe("⌘K");
    expect(formatShortcut("Escape")).toBe("⌘Esc");
    for (const shortcut of SHORTCUTS) {
      expect(formatShortcut(shortcut.key)).toMatch(/^⌘/);
    }
  });
});

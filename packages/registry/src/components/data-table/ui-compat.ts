/**
 * Props that are spelled differently on Radix and on Base UI.
 *
 * The blocks resolve `ui/tooltip`, `ui/hover-card` and friends from whichever
 * library the project was initialized with — `shadcn init -d` gives Base UI,
 * `init -b radix` gives Radix — so a literal prop that only one of them
 * accepts fails to typecheck on the other. Spreading a shared object sets the
 * name the installed primitive reads and leaves the other one inert: a JSX
 * spread is not excess-property checked, and both roots are context providers
 * that render no DOM element, so the unused key never reaches the page.
 *
 * Delete the key you don't need if you only ever install on one library.
 */

/** Radix: `delayDuration`. Base UI: `delay`. */
export const TOOLTIP_DELAY = { delayDuration: 100, delay: 100 };

/** Radix: `openDelay` / `closeDelay`. Base UI: `delay` / `closeDelay`. */
export const HOVER_CARD_DELAY = { openDelay: 0, delay: 0, closeDelay: 0 };

/**
 * Radix: `disableHoverableContent`. Base UI: `hoverable={false}`.
 *
 * Both libraries take this on the tooltip root, which is where it has to go —
 * Base UI's provider doesn't read it.
 */
export const TOOLTIP_NOT_HOVERABLE = {
  disableHoverableContent: true,
  hoverable: false,
};

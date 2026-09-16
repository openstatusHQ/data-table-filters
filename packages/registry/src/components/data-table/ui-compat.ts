/**
 * Props that are spelled differently on Radix and on Base UI.
 *
 * The blocks resolve `ui/tooltip`, `ui/hover-card` and friends from whichever
 * library the project was initialized with — `shadcn init -d` gives Base UI,
 * `init -b radix` gives Radix — so a literal prop that only one of them
 * accepts fails to typecheck on the other. Spreading a shared object sets the
 * name the installed primitive reads and leaves the other one inert: a JSX
 * spread is not excess-property checked, and these roots are context providers
 * that render no DOM element, so the unused key never reaches the page.
 *
 * Delete the key you don't need if you only ever install on one library.
 */

/**
 * Radix: `delayDuration`. Base UI: `delay`.
 *
 * Spread this on the `TooltipProvider`, never on the tooltip itself: Radix
 * reads its spelling on either, but Base UI's tooltip root has no delay prop
 * at all, so on the tooltip this would silently apply to Radix only.
 */
export const TOOLTIP_DELAY = { delayDuration: 100, delay: 100 };

/**
 * Radix: `disableHoverableContent`. Base UI: `disableHoverablePopup`.
 *
 * Both belong on the tooltip root. Radix also accepts its spelling on the
 * provider; Base UI does not, which is why this is separate from the delay.
 */
export const TOOLTIP_NOT_HOVERABLE = {
  disableHoverableContent: true,
  disableHoverablePopup: true,
};

/**
 * Radix: `openDelay` / `closeDelay`.
 *
 * Base UI's preview card — what its `hover-card` is built on — takes neither,
 * so these apply on Radix and Base UI uses its own defaults.
 */
export const HOVER_CARD_DELAY = { openDelay: 0, closeDelay: 0 };

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
 * Radix: `delayDuration`, on the provider or the tooltip.
 *
 * Base UI takes `delay` on the provider only — its tooltip root has no delay
 * prop — so on a tooltip this sets the Radix duration and Base UI keeps the
 * delay its provider was given (shadcn's `base-nova` provider defaults to 0,
 * i.e. already snappier than the 100ms asked for here).
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

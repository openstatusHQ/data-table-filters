import { buttonVariants } from "@dtf/registry/components/ui/button";

/**
 * The unprefixed `rounded-*` utilities of a class string, e.g. `"rounded-lg"`.
 * Variant-prefixed ones (`in-data-[slot=button-group]:rounded-lg`) are
 * conditional, so they say nothing about the box at rest and are skipped.
 */
export function getRadiusClassName(className: string, fallback = "rounded-md") {
  const radius = className
    .split(/\s+/)
    .filter((token) => token.startsWith("rounded-"))
    .join(" ");
  return radius || fallback;
}

/**
 * The radius of the installed shadcn style, for the boxes these blocks draw
 * themselves (filter groups, dropdowns, floating bars, focus rings).
 *
 * A style does not live in `--radius`: `lyra` keeps `--radius: 0.625rem` and
 * writes `rounded-none` into every component instead, so a hardcoded
 * `rounded-lg` stays round on a style that is square everywhere else. The one
 * place each style spells its radius out where we can read it is the
 * `buttonVariants` string, so that is where it comes from.
 */
export const boxRadiusClassName = getRadiusClassName(
  buttonVariants({ variant: "outline" }),
);

/**
 * The resting background utilities of a class string, light and dark
 * (`bg-background dark:bg-input/30`). Interactive ones (`hover:bg-muted`,
 * `aria-expanded:bg-muted`) are skipped, and so is `bg-clip-*`, which is not a
 * colour.
 */
export function getBackgroundClassName(className: string) {
  return className
    .split(/\s+/)
    .filter((token) => /^(dark:)?bg-(?!clip-)/.test(token))
    .join(" ");
}

/**
 * The resting border utilities of a class string, light and dark
 * (`border border-border dark:border-input`). A style may name a colour twice
 * (nova: `border-transparent` in the base, `border-border` in the variant); the
 * tokens keep their order, so `cn` resolves them the way it does for the button.
 */
export function getBorderClassName(className: string) {
  return className
    .split(/\s+/)
    .filter((token) => /^(dark:)?border(-|$)/.test(token))
    .join(" ");
}

/**
 * Radius, border and background of the style's outlined controls, for a box that sits
 * next to them and should read as one of them — the checkbox filter list beside
 * the date picker and the inputs, which most styles tint in dark mode.
 */
export const boxSurfaceClassName = [
  boxRadiusClassName,
  getBorderClassName(buttonVariants({ variant: "outline" })),
  getBackgroundClassName(buttonVariants({ variant: "outline" })),
]
  .filter(Boolean)
  .join(" ");

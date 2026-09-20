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

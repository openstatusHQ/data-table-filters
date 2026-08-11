import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// A consumer export that lives alongside `cn`. If a block overwrites this file,
// this disappears — which is exactly the regression from issue #79.
export const FIXTURE_SENTINEL = "do-not-clobber";

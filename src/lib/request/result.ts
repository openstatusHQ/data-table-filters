import { RESULTS } from "@/constants/results";
import { cn } from "../utils";

export function getResultColor(
  value: (typeof RESULTS)[number]
): Record<"text" | "bg" | "border", string> {
  switch (value) {
    case "success":
      return {
        text: "text-muted",
        bg: "bg-muted",
        border: "border-gray-200 dark:border-gray-800",
      };
    case "warning":
      return {
        text: "text-orange-500",
        bg: "bg-orange-500",
        border: "border-orange-200 dark:border-orange-800",
      };
    case "error":
      return {
        text: "text-red-500",
        bg: "bg-red-500",
        border: "border-red-200 dark:border-red-800",
      };
    default:
      return {
        text: "text-gray-500",
        bg: "bg-gray-500",
        border: "border-gray-200 dark:border-gray-800",
      };
  }
}

export function getResultRowClassName(value: (typeof RESULTS)[number]): string {
  switch (value) {
    case "success":
      return "";
    case "warning":
      return cn(
        "bg-orange-500/5 hover:bg-orange-500/10 data-[state=selected]:bg-orange-500/20 focus-visible:bg-orange-500/10",
        "dark:bg-orange-500/20 dark:hover:bg-orange-500/30 dark:data-[state=selected]:bg-orange-500/40 dark:focus-visible:bg-orange-500/30"
      );
    case "error":
      return cn(
        "bg-destructive/5 hover:bg-destructive/10 data-[state=selected]:bg-destructive/20 focus-visible:bg-destructive/10",
        "dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:data-[state=selected]:bg-destructive/40 dark:focus-visible:bg-destructive/30"
      );
  }
}

export function getResultLabel(value: (typeof RESULTS)[number]): string {
  switch (value) {
    case "success":
      return "2xx";
    case "warning":
      return "4xx";
    case "error":
      return "5xx";
    default:
      return "Unknown";
  }
}

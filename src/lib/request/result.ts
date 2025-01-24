import { RESULTS } from "@/constants/results";

export function getResultColor(
  value: (typeof RESULTS)[number]
): Record<"text" | "bg" | "border", string> {
  switch (value) {
    case "success":
      return {
        text: "text-muted",
        bg: "bg-muted",
        border: "border-green-200 dark:border-green-800",
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

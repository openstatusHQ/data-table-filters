export function getStatusColor(
  value: number
): Record<"text" | "bg" | "border", string> {
  if (value < 100 || value >= 600)
    return {
      text: "text-gray-500",
      bg: "bg-gray-100",
      border: "border-gray-200",
    };
  switch (value.toString().charAt(0)) {
    case "1":
      return {
        text: "text-blue-500",
        bg: "bg-blue-100",
        border: "border-blue-200",
      };
    case "2":
      return {
        text: "text-green-500",
        bg: "bg-green-100",
        border: "border-green-200",
      };
    case "3":
      return {
        text: "text-yellow-500",
        bg: "bg-yellow-100",
        border: "border-yellow-200",
      };
    case "4":
      return {
        text: "text-orange-500",
        bg: "bg-orange-100",
        border: "border-orange-200",
      };
    case "5":
      return {
        text: "text-red-500",
        bg: "bg-red-100",
        border: "border-red-200",
      };
    default:
      return {
        text: "text-gray-500",
        bg: "bg-gray-100",
        border: "border-gray-200",
      };
  }
}

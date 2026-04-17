import { queryOptions } from "@tanstack/react-query";
import type { ColumnSchema } from "./types";

interface ApiResponse {
  data: ColumnSchema[];
  total: number;
}

export const dataOptions = (search: Record<string, any>) =>
  queryOptions({
    queryKey: ["default-data", search],
    queryFn: async () => {
      const response = await fetch("/default/api");
      if (!response.ok) {
        throw new Error("Failed to fetch data");
      }
      const result: ApiResponse = await response.json();
      return result;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

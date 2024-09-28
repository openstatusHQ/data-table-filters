import { isSameDay } from "date-fns";
import { type ColumnSchema, REGIONS } from "../schema";
import type { SearchParamsType } from "../search-params";
import {
  isArrayOfBooleans,
  isArrayOfDates,
  isArrayOfNumbers,
} from "@/lib/helpers";

export function filterData(
  data: ColumnSchema[],
  search: SearchParamsType
): ColumnSchema[] {
  const { start, size, sort, ...filters } = search;
  return data.filter((row) => {
    for (const key in filters) {
      const filter = filters[key as keyof typeof filters];
      if (filter === undefined || filter === null) continue;
      if (key === "latency" && isArrayOfNumbers(filter)) {
        if (filter.length === 1 && row[key as "latency"] !== filter[0]) {
          return false;
        } else if (
          filter.length === 2 &&
          (row[key as "latency"] < filter[0] ||
            row[key as "latency"] > filter[1])
        ) {
          return false;
        }
        return true;
      }
      if (key === "status" && isArrayOfNumbers(filter)) {
        if (!filter.includes(row[key as "status"])) {
          return false;
        }
      }
      if (key === "regions" && Array.isArray(filter)) {
        const typedFilter = filter as unknown as typeof REGIONS;
        if (!typedFilter.includes(row[key as "regions"]?.[0])) {
          return false;
        }
      }
      if (key === "date" && isArrayOfDates(filter)) {
        if (filter.length === 1 && !isSameDay(row[key as "date"], filter[0])) {
          return false;
        } else if (
          filter.length === 2 &&
          (row[key as "date"].getTime() < filter[0].getTime() ||
            row[key as "date"].getTime() > filter[1].getTime())
        ) {
          return false;
        }
      }
      if (key === "success" && isArrayOfBooleans(filter)) {
        if (!filter.includes(row[key as "success"])) {
          return false;
        }
      }
    }
    return true;
  });
}

// TODO: we should include `timing.dns.desc` as a filter so
// { id: "timing.dns", desc: true }

export function sortData(data: ColumnSchema[], sort: SearchParamsType["sort"]) {
  if (!sort) return data;
  return data.sort((a, b) => {
    if (sort.desc) {
      // @ts-ignore
      return a?.[sort.id] < b[sort.id] ? 1 : -1;
    } else {
      // @ts-ignore
      return a[sort.id] > b[sort.id] ? 1 : -1;
    }
  });
}

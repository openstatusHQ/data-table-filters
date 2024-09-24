import { isSameDay } from "date-fns";
import { type ColumnSchema, REGIONS } from "../schema";
import type { SearchParamsType } from "../search-params";

export function filterData(
  data: ColumnSchema[],
  search: SearchParamsType
): ColumnSchema[] {
  const { start, size, sort, ...filters } = search;
  return data.filter((row) => {
    for (const key in filters) {
      const filter = filters[key as keyof typeof filters];
      if (filter === undefined || filter === null) continue;
      if (key === "latency" && Array.isArray(filter)) {
        if (filter.length === 1 && row[key as keyof typeof row] !== filter[0]) {
          return false;
        } else if (
          filter.length === 2 &&
          (row[key as keyof typeof row] < filter[0] ||
            row[key as keyof typeof row] > filter[1])
        ) {
          return false;
        }
        return true;
      }
      if (key === "status" && Array.isArray(filter)) {
        const typedFilter = filter as number[];
        if (!typedFilter.includes(row[key as "status"])) {
          return false;
        }
      }
      if (key === "regions" && Array.isArray(filter)) {
        const typedFilter = filter as unknown as typeof REGIONS;
        if (!typedFilter.includes(row[key as "regions"]?.[0])) {
          return false;
        }
      }
      if (key === "date" && Array.isArray(filter)) {
        const typedFilter = filter as Date[];
        if (
          typedFilter.length === 1 &&
          !isSameDay(row[key as "date"], typedFilter[0])
        ) {
          return false;
        } else if (
          typedFilter.length === 2 &&
          (row[key as "date"].getTime() < typedFilter[0].getTime() ||
            row[key as "date"].getTime() > typedFilter[1].getTime())
        ) {
          return false;
        }
      }
      if (key === "success" && Array.isArray(filter)) {
        const typedFilter = filter as boolean[];
        if (!typedFilter.includes(row[key as "success"])) {
          return false;
        }
      }
    }
    return true;
  });
}

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

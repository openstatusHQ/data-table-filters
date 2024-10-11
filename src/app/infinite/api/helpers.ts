import { addMilliseconds, differenceInMinutes, isSameDay } from "date-fns";
import { type ColumnSchema } from "../schema";
import type { SearchParamsType } from "../search-params";
import {
  isArrayOfBooleans,
  isArrayOfDates,
  isArrayOfNumbers,
} from "@/lib/is-array";
import {
  calculatePercentile,
  calculateSpecificPercentile,
} from "@/lib/request/percentile";
import { REGIONS } from "@/constants/region";

export function filterData(
  data: ColumnSchema[],
  search: Partial<SearchParamsType>
): ColumnSchema[] {
  const { start, size, sort, ...filters } = search;
  return data.filter((row) => {
    for (const key in filters) {
      const filter = filters[key as keyof typeof filters];
      if (filter === undefined || filter === null) continue;
      if (
        (key === "latency" ||
          key === "timing.dns" ||
          key === "timing.connection" ||
          key === "timing.tls" ||
          key === "timing.ttfb" ||
          key === "timing.transfer") &&
        isArrayOfNumbers(filter)
      ) {
        if (filter.length === 1 && row[key] !== filter[0]) {
          return false;
        } else if (
          filter.length === 2 &&
          (row[key] < filter[0] || row[key] > filter[1])
        ) {
          return false;
        }
        return true;
      }
      if (key === "status" && isArrayOfNumbers(filter)) {
        if (!filter.includes(row[key])) {
          return false;
        }
      }
      if (key === "regions" && Array.isArray(filter)) {
        const typedFilter = filter as unknown as typeof REGIONS;
        if (!typedFilter.includes(row[key]?.[0])) {
          return false;
        }
      }
      if (key === "date" && isArrayOfDates(filter)) {
        if (filter.length === 1 && !isSameDay(row[key], filter[0])) {
          return false;
        } else if (
          filter.length === 2 &&
          (row[key].getTime() < filter[0].getTime() ||
            row[key].getTime() > filter[1].getTime())
        ) {
          return false;
        }
      }
      if (key === "success" && isArrayOfBooleans(filter)) {
        if (!filter.includes(row[key])) {
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
      return a?.[sort.id] < b?.[sort.id] ? 1 : -1;
    } else {
      // @ts-ignore
      return a?.[sort.id] > b?.[sort.id] ? 1 : -1;
    }
  });
}

// TODO: later on, we could hover over the percentile to get a concrete value for the p50, p75, p90, p95, p99
// for better comparability
export function percentileData(data: ColumnSchema[]): ColumnSchema[] {
  const latencies = data.map((row) => row.latency);
  return data.map((row) => ({
    ...row,
    percentile: calculatePercentile(latencies, row.latency),
  }));
}

export function getPercentileFromData(data: ColumnSchema[]) {
  const latencies = data.map((row) => row.latency);

  const p50 = calculateSpecificPercentile(latencies, 50);
  const p75 = calculateSpecificPercentile(latencies, 75);
  const p90 = calculateSpecificPercentile(latencies, 90);
  const p95 = calculateSpecificPercentile(latencies, 95);
  const p99 = calculateSpecificPercentile(latencies, 99);

  return { p50, p75, p90, p95, p99 };
}

// function that returns the objects for the chart
// { timestamp: number, [key: string]: number }[] // mainly for {200: number, 400: number, 500: number}
// If range is short, consider use more minutes, if range is long, consider use more hours
// You can use date-fns to format
export function groupGraphData(
  data: ColumnSchema[]
): { timestamp: number; [key: string]: number }[] {
  if (data?.length === 0) return [];
  const interval = evaluateInterval(data);
  console.log(interval, data.length);
  return groupDataByInterval(data, interval);
}

function evaluateInterval(data: ColumnSchema[]): number {
  if (data.length === 0) {
    return 0;
  }

  const first = data[0];
  const last = data[data.length - 1];

  // Calculate the time difference in minutes
  const timeDiffInMinutes = Math.abs(
    differenceInMinutes(first.date, last.date)
  );

  // Define thresholds and their respective intervals in milliseconds
  const intervals = [
    { threshold: 1, interval: 1000 }, // 1 second
    { threshold: 5, interval: 5000 }, // 5 seconds
    { threshold: 10, interval: 10000 }, // 10 seconds
    { threshold: 30, interval: 30000 }, // 30 seconds
    { threshold: 60, interval: 60000 }, // 1 minute
    { threshold: 120, interval: 120000 }, // 2 minutes
    { threshold: 240, interval: 240000 }, // 4 minutes
    { threshold: 480, interval: 480000 }, // 8 minutes
    { threshold: 1440, interval: 1440000 }, // 24 minutes
    { threshold: 2880, interval: 2880000 }, // 48 minutes
    { threshold: 5760, interval: 5760000 }, // 96 minutes
    { threshold: 11520, interval: 11520000 }, // 192 minutes
    { threshold: 23040, interval: 23040000 }, // 384 minutes
  ];

  // Iterate over the intervals and return the matching one
  for (const { threshold, interval } of intervals) {
    if (timeDiffInMinutes < threshold) {
      return interval;
    }
  }

  // Default to the largest interval if no match found
  return 46080000; // 768 minutes
}

function groupDataByInterval(
  data: ColumnSchema[],
  interval: number
): { timestamp: number; [key: string]: number }[] {
  const first = data[data.length - 1];
  const last = data[0];

  const duration = Math.abs(first.date.getTime() - last.date.getTime());
  const steps = Math.floor(duration / interval);

  const timestamps: { date: Date }[] = [];

  // Generate the timestamps
  for (let i = 0; i < steps; i++) {
    const newTimestamp = addMilliseconds(first.date, i * interval);
    timestamps.push({ date: newTimestamp });
  }

  // TODO: make it dynamic to avoid havin 200, 400, 500 hardcoded
  // TODO: make it more efficient
  // e.g. make the "status" prop we use as T generic
  return timestamps.map((timestamp, i) => {
    const filteredData = data.filter((row) => {
      const diff = Math.abs(row.date.getTime() - timestamp.date.getTime());
      return diff < interval;
    });

    return {
      timestamp: timestamp.date.getTime(), // TODO: use date-fns and interval to determine the format
      200: filteredData.filter((row) => row.status === 200).length,
      400: filteredData.filter((row) => row.status === 400).length,
      500: filteredData.filter((row) => row.status === 500).length,
    };
  });
}

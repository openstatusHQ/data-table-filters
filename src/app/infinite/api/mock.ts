import { METHODS } from "@/constants/method";
import { ColumnSchema } from "../schema";
import { subMinutes } from "date-fns";
import { REGIONS } from "@/constants/region";

function getRandomTiming(latency: number) {
  // Generate random percentages within the specified ranges
  const dns = Math.random() * (0.15 - 0.05) + 0.05; // 5% to 15%
  const connection = Math.random() * (0.3 - 0.1) + 0.1; // 10% to 30%
  const tls = Math.random() * (0.1 - 0.05) + 0.05; // 5% to 10%
  const transfer = Math.random() * (0.004 - 0) + 0.004; // 0% to 0.4%

  // Ensure the sum of dns, connection, tls, and transfer is subtracted from 100% for ttfb
  const remaining = 1 - (dns + connection + tls + transfer); // Calculate remaining for ttfb

  return {
    "timing.dns": Math.round(latency * dns),
    "timing.connection": Math.round(latency * connection),
    "timing.tls": Math.round(latency * tls),
    "timing.ttfb": Math.round(latency * remaining), // Use the remaining percentage for ttfb
    "timing.transfer": Math.round(latency * transfer),
  };
}

function getRandomStatusCode() {
  const rand = Math.random();
  if (rand < 0.9) {
    return 200;
  } else if (rand < 0.94) {
    return 400;
  } else {
    return 500;
  }
}

function getMessage() {
  return 'ERR_INTERNAL_DISASTER: "The server spilled coffee on itself."';
}

const pathnames = ["/bikes/gravel", "/bikes/racing", "/bikes/mountain"];

function getRandomRequestObject(): {
  method: (typeof METHODS)[number];
  host: string;
  pathname: string;
} {
  const rand = Math.random();
  if (rand < 0.5) {
    return {
      method: "POST",
      host: "api.acme-shop.com",
      pathname: "/v1/products",
    };
  } else {
    return {
      method: "GET",
      host: "acme-shop.com",
      pathname: pathnames[Math.floor(Math.random() * pathnames.length)],
    };
  }
}

function getHeaders() {
  return {
    Age: "0",
    "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
    Server: "Cloudflare",
  };
}

const multiplier: Record<(typeof REGIONS)[number], number> = {
  ams: 1,
  iad: 0.6,
  gru: 1.6,
  syd: 1.3,
  fra: 0.8,
  hkg: 1.4,
};

export function createMockData({
  minutes = 0,
}: {
  size?: number;
  minutes?: number;
}): ColumnSchema[] {
  const date = subMinutes(new Date(), minutes);
  const random = Math.random();

  const statusCode = {
    ams: getRandomStatusCode(),
    iad: getRandomStatusCode(),
    gru: getRandomStatusCode(),
    syd: getRandomStatusCode(),
    fra: getRandomStatusCode(),
    hkg: getRandomStatusCode(),
  };

  const latency = {
    ams: Math.round(1000 * (random * (1 - multiplier.ams) + multiplier.ams)),
    iad: Math.round(1000 * (random * (1 - multiplier.iad) + multiplier.iad)),
    gru: Math.round(1000 * (random * (1 - multiplier.gru) + multiplier.gru)),
    syd: Math.round(1000 * (random * (1 - multiplier.syd) + multiplier.syd)),
    fra: Math.round(1000 * (random * (1 - multiplier.fra) + multiplier.fra)),
    hkg: Math.round(1000 * (random * (1 - multiplier.hkg) + multiplier.hkg)),
  };

  const requestObject = getRandomRequestObject();
  const headers = getHeaders();

  return [
    {
      uuid: crypto.randomUUID(),
      success: 200 === statusCode.ams,
      latency: latency.ams,
      regions: ["ams"],
      status: statusCode.ams,
      date,
      headers,
      message: 500 === statusCode.ams ? getMessage() : undefined,
      ...getRandomTiming(latency.ams),
      ...requestObject,
    },
    {
      uuid: crypto.randomUUID(),
      success: 200 === statusCode.iad,
      latency: latency.iad,
      regions: ["iad"],
      status: statusCode.iad,
      date,
      headers,
      message: 500 === statusCode.iad ? getMessage() : undefined,
      ...getRandomTiming(latency.iad),
      ...requestObject,
    },
    {
      uuid: crypto.randomUUID(),
      success: 200 === statusCode.gru,
      latency: latency.gru,
      regions: ["gru"],
      status: statusCode.gru,
      date,
      headers,
      message: 500 === statusCode.gru ? getMessage() : undefined,
      ...getRandomTiming(latency.gru),
      ...requestObject,
    },
    {
      uuid: crypto.randomUUID(),
      success: 200 === statusCode.syd,
      latency: latency.syd,
      regions: ["syd"],
      status: statusCode.syd,
      date,
      headers,
      message: 500 === statusCode.syd ? getMessage() : undefined,
      ...getRandomTiming(latency.syd),
      ...requestObject,
    },
    {
      uuid: crypto.randomUUID(),
      success: 200 === statusCode.fra,
      latency: latency.fra,
      regions: ["fra"],
      status: statusCode.fra,
      date,
      headers,
      message: 500 === statusCode.fra ? getMessage() : undefined,
      ...getRandomTiming(latency.fra),
      ...requestObject,
    },
    {
      uuid: crypto.randomUUID(),
      success: 200 === statusCode.hkg,
      latency: latency.hkg,
      regions: ["hkg"],
      status: statusCode.hkg,
      date,
      headers,
      message: 500 === statusCode.hkg ? getMessage() : undefined,
      ...getRandomTiming(latency.hkg),
      ...requestObject,
    },
  ];
}

export const mock = Array.from({ length: 14 * 24 })
  .map((_, i) => createMockData({ minutes: i * 60 }))
  .reduce((prev, curr) => prev.concat(curr), []) satisfies ColumnSchema[];

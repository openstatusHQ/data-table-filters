import { METHODS } from "@/constants/method";
import { ColumnSchema } from "../schema";
import { subMinutes } from "date-fns";

const DAYS = 20;

function getRandomLatency() {
  return Math.round(Math.random() * 1000);
}

function getLevel(status: number) {
  if (`${status}`.startsWith("2")) return "success";
  if (`${status}`.startsWith("4")) return "warning";
  if (`${status}`.startsWith("5")) return "error";
  return "error";
}

function getRandomStatusCode() {
  const rand = Math.random();
  if (rand < 0.9) {
    return 200;
  } else if (rand < 0.96) {
    if (Math.random() < 0.5) {
      return 400;
    } else {
      return 404;
    }
  } else {
    return 500;
  }
}

function getMessage() {
  return 'ERR_INTERNAL_DISASTER: "The server spilled coffee on itself."';
}

const shopPathnames = [
  "/bikes/gravel/road",
  "/bikes/racing/track",
  "/bikes/mountain/trail",
  "/bikes/city/cargo",
];

const apiPathnames = ["/v1/products", "/v1/orders", "/v1/customers"];

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
      pathname: apiPathnames[Math.floor(Math.random() * apiPathnames.length)],
    };
  } else {
    return {
      method: "GET",
      host: "acme-shop.com",
      pathname: shopPathnames[Math.floor(Math.random() * shopPathnames.length)],
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

export function createMockData({
  minutes = 0,
}: {
  size?: number;
  minutes?: number;
}): ColumnSchema[] {
  const date = subMinutes(new Date(), minutes);

  const statusCode = {
    ams: getRandomStatusCode(),
    iad: getRandomStatusCode(),
    gru: getRandomStatusCode(),
    syd: getRandomStatusCode(),
    fra: getRandomStatusCode(),
    hkg: getRandomStatusCode(),
  };

  const requestObject = getRandomRequestObject();
  const headers = getHeaders();

  return [
    {
      uuid: crypto.randomUUID(),
      level: getLevel(statusCode.ams),
      latency: getRandomLatency(),
      status: statusCode.ams,
      date,
      headers,
      message: 500 === statusCode.ams ? getMessage() : undefined,
      ...requestObject,
    },
    {
      uuid: crypto.randomUUID(),
      level: getLevel(statusCode.iad),
      latency: getRandomLatency(),
      status: statusCode.iad,
      date,
      headers,
      message: 500 === statusCode.iad ? getMessage() : undefined,
      ...requestObject,
    },
    {
      uuid: crypto.randomUUID(),
      level: getLevel(statusCode.gru),
      latency: getRandomLatency(),
      status: statusCode.gru,
      date,
      headers,
      message: 500 === statusCode.gru ? getMessage() : undefined,
      ...requestObject,
    },
    {
      uuid: crypto.randomUUID(),
      level: getLevel(statusCode.syd),
      latency: getRandomLatency(),
      status: statusCode.syd,
      date,
      headers,
      message: 500 === statusCode.syd ? getMessage() : undefined,
      ...requestObject,
    },
    {
      uuid: crypto.randomUUID(),
      level: getLevel(statusCode.fra),
      latency: getRandomLatency(),
      status: statusCode.fra,
      date,
      headers,
      message: 500 === statusCode.fra ? getMessage() : undefined,
      ...requestObject,
    },
    {
      uuid: crypto.randomUUID(),
      level: getLevel(statusCode.hkg),
      latency: getRandomLatency(),
      status: statusCode.hkg,
      date,
      headers,
      message: 500 === statusCode.hkg ? getMessage() : undefined,
      ...requestObject,
    },
  ];
}

export const mock = Array.from({ length: DAYS * 24 })
  .map((_, i) => createMockData({ minutes: i * 60 }))
  .reduce((prev, curr) => prev.concat(curr), []) satisfies ColumnSchema[];

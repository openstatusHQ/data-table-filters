import { METHODS } from "@/constants/method";
import { REGIONS } from "@/constants/region";
import { subMinutes } from "date-fns";

function getRandomTiming(latency: number) {
  const dns = Math.random() * (0.15 - 0.05) + 0.05;
  const connection = Math.random() * (0.3 - 0.1) + 0.1;
  const tls = Math.random() * (0.1 - 0.05) + 0.05;
  const transfer = Math.random() * (0.004 - 0) + 0.004;
  const remaining = 1 - (dns + connection + tls + transfer);

  return {
    "timing.dns": Math.round(latency * dns),
    "timing.connection": Math.round(latency * connection),
    "timing.tls": Math.round(latency * tls),
    "timing.ttfb": Math.round(latency * remaining),
    "timing.transfer": Math.round(latency * transfer),
  };
}

function getLevel(status: number) {
  if (`${status}`.startsWith("2")) return "success" as const;
  if (`${status}`.startsWith("4")) return "warning" as const;
  return "error" as const;
}

function getRandomStatusCode() {
  const rand = Math.random();
  if (rand < 0.9) return 200;
  if (rand < 0.96) return Math.random() < 0.5 ? 400 : 404;
  return 500;
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
  }
  return {
    method: "GET",
    host: "acme-shop.com",
    pathname: shopPathnames[Math.floor(Math.random() * shopPathnames.length)],
  };
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

export function createMockLogs({ minutes = 0 }: { minutes?: number }) {
  const date = subMinutes(new Date(), minutes);
  const random = Math.random();
  const requestObject = getRandomRequestObject();
  const headers = getHeaders();

  return REGIONS.map((region) => {
    const status = getRandomStatusCode();
    const latency = Math.round(
      1000 * (random * (1 - multiplier[region]) + multiplier[region]),
    );
    return {
      uuid: crypto.randomUUID(),
      level: getLevel(status),
      latency,
      regions: [region] as (typeof REGIONS)[number][],
      status,
      date,
      headers,
      message: status === 500 ? getMessage() : undefined,
      ...getRandomTiming(latency),
      ...requestObject,
    };
  });
}

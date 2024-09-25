import { ColumnSchema, REGIONS } from "../schema";
import { subMinutes } from "date-fns";

function getRandomTiming(latency: number) {
  // Generate random percentages within the specified ranges
  const dns = Math.random() * (0.15 - 0.05) + 0.05; // 5% to 15%
  const connection = Math.random() * (0.3 - 0.1) + 0.1; // 10% to 30%
  const tls = Math.random() * (0.1 - 0.05) + 0.05; // 5% to 10%
  const transfer = Math.random() * (0.2 - 0.1) + 0.1; // 10% to 20%

  // Ensure the sum of dns, connection, tls, and transfer is subtracted from 100% for ttfb
  const remaining = 1 - (dns + connection + tls + transfer); // Calculate remaining for ttfb

  return {
    dns: Math.round(latency * dns),
    connection: Math.round(latency * connection),
    tls: Math.round(latency * tls),
    ttfb: Math.round(latency * remaining), // Use the remaining percentage for ttfb
    transfer: Math.round(latency * transfer),
  };
}

function getRandomValue() {
  const rand = Math.random();
  if (rand < 0.9) {
    return 200;
  } else if (rand < 0.96) {
    return 400;
  } else {
    return 500;
  }
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
    ams: getRandomValue(),
    iad: getRandomValue(),
    gru: getRandomValue(),
    syd: getRandomValue(),
    fra: getRandomValue(),
    hkg: getRandomValue(),
  };

  const latency = {
    ams: Math.round(1000 * (random * (1 - multiplier.ams) + multiplier.ams)),
    iad: Math.round(1000 * (random * (1 - multiplier.iad) + multiplier.iad)),
    gru: Math.round(1000 * (random * (1 - multiplier.gru) + multiplier.gru)),
    syd: Math.round(1000 * (random * (1 - multiplier.syd) + multiplier.syd)),
    fra: Math.round(1000 * (random * (1 - multiplier.fra) + multiplier.fra)),
    hkg: Math.round(1000 * (random * (1 - multiplier.hkg) + multiplier.hkg)),
  };

  return [
    {
      uuid: crypto.randomUUID(),
      success: 200 === statusCode.ams,
      latency: latency.ams,
      regions: ["ams"],
      status: statusCode.ams,
      date,
      timing: getRandomTiming(latency.ams),
    },
    {
      uuid: crypto.randomUUID(),
      success: 200 === statusCode.iad,
      latency: latency.iad,
      regions: ["iad"],
      status: statusCode.iad,
      date,
      timing: getRandomTiming(latency.iad),
    },
    {
      uuid: crypto.randomUUID(),
      success: 200 === statusCode.gru,
      latency: latency.gru,
      regions: ["gru"],
      status: statusCode.gru,
      date,
      timing: getRandomTiming(latency.gru),
    },
    {
      uuid: crypto.randomUUID(),
      success: 200 === statusCode.syd,
      latency: latency.syd,
      regions: ["syd"],
      status: statusCode.syd,
      date,
      timing: getRandomTiming(latency.syd),
    },
    {
      uuid: crypto.randomUUID(),
      success: 200 === statusCode.fra,
      latency: latency.fra,
      regions: ["fra"],
      status: statusCode.fra,
      date,
      timing: getRandomTiming(latency.fra),
    },
    {
      uuid: crypto.randomUUID(),
      success: 200 === statusCode.hkg,
      latency: latency.hkg,
      regions: ["hkg"],
      status: statusCode.hkg,
      date,
      timing: getRandomTiming(latency.hkg),
    },
  ];
}

export const mock = Array.from({ length: 14 * 24 })
  .map((_, i) => createMockData({ minutes: i * 60 }))
  .reduce((prev, curr) => prev.concat(curr), []) satisfies ColumnSchema[];

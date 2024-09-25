import { ColumnSchema, REGIONS } from "../schema";
import { subMinutes } from "date-fns";

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

  return [
    {
      success: 200 === statusCode.ams,
      latency: Math.round(
        1000 * (random * (1 - multiplier.ams) + multiplier.ams)
      ),
      regions: ["ams"],
      status: statusCode.ams,
      date,
    },
    {
      success: 200 === statusCode.iad,
      latency: Math.round(
        1000 * (random * (1 - multiplier.iad) + multiplier.iad)
      ),
      regions: ["iad"],
      status: statusCode.iad,
      date,
    },
    {
      success: 200 === statusCode.gru,
      latency: Math.round(
        1000 * (random * (1 - multiplier.ams) + multiplier.gru)
      ),
      regions: ["gru"],
      status: statusCode.gru,
      date,
    },
    {
      success: 200 === statusCode.syd,
      latency: Math.round(
        1000 * (random * (1 - multiplier.syd) + multiplier.syd)
      ),
      regions: ["syd"],
      status: statusCode.syd,
      date,
    },
    {
      success: 200 === statusCode.fra,
      latency: Math.round(
        1000 * (random * (1 - multiplier.fra) + multiplier.fra)
      ),
      regions: ["fra"],
      status: statusCode.fra,
      date,
    },
    {
      success: 200 === statusCode.hkg,
      latency: Math.round(
        1000 * (random * (1 - multiplier.hkg) + multiplier.hkg)
      ),
      regions: ["hkg"],
      status: statusCode.hkg,
      date,
    },
  ];
}

export const mock = Array.from({ length: 14 * 24 })
  .map((_, i) => createMockData({ minutes: i * 60 }))
  .reduce((prev, curr) => prev.concat(curr), []) satisfies ColumnSchema[];

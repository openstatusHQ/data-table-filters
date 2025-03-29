// TODO: use types

import { LEVELS } from "@/constants/levels";
import { VERCEL_EDGE_REGIONS } from "@/constants/region";

export type ColumnType = {
  level: (typeof LEVELS)[number];
  url: string;
  method: string;
  status: number;
  latency: number;
  region: (typeof VERCEL_EDGE_REGIONS)[number];
  timestamp: number;
  headers: string;
  body: string;
};

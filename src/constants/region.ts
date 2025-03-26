export const REGIONS = ["ams", "fra", "gru", "hkg", "iad", "syd"] as const;

export const regions: Record<string, string> = {
  ams: "Amsterdam",
  fra: "Frankfurt",
  gru: "Sao Paulo",
  hkg: "Hong Kong",
  iad: "Washington D.C.",
  syd: "Sydney",
};

export const flags: Record<string, string> = {
  ams: "🇳🇱",
  fra: "🇩🇪",
  gru: "🇧🇷",
  hkg: "🇭🇰",
  iad: "🇺🇸",
  syd: "🇦🇺",
};

export const VERCEL_EDGE_REGIONS = [
  "hnd1",
  "sin1",
  "cpt1",
  "fra1",
  "hkg1",
  "syd1",
  "gru1",
  "dub1",
  "sfo1",
  "cdg1",
  "icn1",
  "kix1",
  "iad1",
  "arn1",
  "bom1",
  "lhr1",
  "cle1",
];

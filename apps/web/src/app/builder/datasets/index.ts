import type { SchemaJSON } from "@dtf/registry/lib/table-schema";
import { cocktailsData } from "./cocktails";
import { httpLogsData } from "./http-logs";
import { issuesData } from "./issues";
import { moviesData } from "./movies";
import { ordersData } from "./orders";
import { pokemonData } from "./pokemon";
import { rpgCharactersData } from "./rpg-characters";
import { spaceMissionsData } from "./space-missions";

export type { Pokemon } from "./pokemon";
export type { HttpLog } from "./http-logs";
export type { SpaceMission } from "./space-missions";
export type { Cocktail } from "./cocktails";
export type { Order } from "./orders";
export type { Issue } from "./issues";
export type { Movie } from "./movies";
export type { RpgCharacter } from "./rpg-characters";

export type ExampleDataset = {
  label: string;
  data: Record<string, unknown>[];
  colorMaps?: Record<string, Record<string, string>>;
};

export const EXAMPLE_DATASETS: ExampleDataset[] = [
  {
    label: "Pokemon",
    data: pokemonData,
    colorMaps: {
      type: {
        Fire: "#ef4444",
        Water: "#3b82f6",
        Grass: "#22c55e",
        Electric: "#eab308",
        Psychic: "#a855f7",
        Ghost: "#6366f1",
        Dragon: "#f97316",
        Fairy: "#ec4899",
        Normal: "#6b7280",
        Ice: "#06b6d4",
      },
    },
  },
  {
    label: "HTTP Logs",
    data: httpLogsData,
    colorMaps: {
      status: {
        "200": "#22c55e",
        "201": "#22c55e",
        "204": "#22c55e",
        "301": "#3b82f6",
        "400": "#f97316",
        "401": "#f97316",
        "403": "#f97316",
        "404": "#f97316",
        "500": "#ef4444",
        "502": "#ef4444",
        "503": "#ef4444",
      },
    },
  },
  {
    label: "Space Missions",
    data: spaceMissionsData,
    colorMaps: {
      status: {
        Success: "#22c55e",
        Failure: "#ef4444",
        Planned: "#6b7280",
        "In-Progress": "#3b82f6",
      },
    },
  },
  {
    label: "Cocktails",
    data: cocktailsData,
    colorMaps: {
      strength: {
        Light: "#22c55e",
        Medium: "#eab308",
        Strong: "#ef4444",
      },
    },
  },
  { label: "Orders", data: ordersData },
  {
    label: "Issues",
    data: issuesData,
    colorMaps: {
      status: {
        open: "#22c55e",
        in_progress: "#3b82f6",
        in_review: "#a855f7",
        blocked: "#ef4444",
        closed: "#6b7280",
      },
      priority: {
        critical: "#ef4444",
        high: "#f97316",
        medium: "#eab308",
        low: "#6b7280",
      },
    },
  },
  { label: "Movies", data: moviesData },
  {
    label: "RPG Characters",
    data: rpgCharactersData,
    colorMaps: {
      class: {
        Warrior: "#ef4444",
        Mage: "#a855f7",
        Rogue: "#6b7280",
        Healer: "#22c55e",
        Ranger: "#16a34a",
        Paladin: "#eab308",
      },
    },
  },
];

export const PLACEHOLDER_DATA = EXAMPLE_DATASETS[0].data;
export const PLACEHOLDER_DATA_JSON = JSON.stringify(PLACEHOLDER_DATA, null, 2);

/**
 * Apply colorMaps from an ExampleDataset onto an inferred SchemaJSON.
 * Matches dataset by data reference equality.
 */
export function applyDatasetColorMaps(
  schema: SchemaJSON,
  data: Record<string, unknown>[],
): void {
  const dataset = EXAMPLE_DATASETS.find((d) => d.data === data);
  if (!dataset?.colorMaps) return;
  for (const col of schema.columns) {
    const colorMap = dataset.colorMaps[col.key];
    if (colorMap) {
      col.display = { ...col.display, colorMap };
    }
  }
}

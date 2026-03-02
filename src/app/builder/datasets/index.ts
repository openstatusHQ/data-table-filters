import { auctionBidsData } from "./auction-bids";
import { employeesData } from "./employees";
import { httpLogsData } from "./http-logs";
import { issuesData } from "./issues";
import { locationsData } from "./locations";
import { moviesData } from "./movies";
import { notesData } from "./notes";
import { ordersData } from "./orders";

export type { Employee } from "./employees";
export type { HttpLog } from "./http-logs";
export type { Note } from "./notes";
export type { AuctionBid } from "./auction-bids";
export type { Order } from "./orders";
export type { Issue } from "./issues";
export type { Movie } from "./movies";
export type { Location } from "./locations";

export type ExampleDataset = {
  label: string;
  data: Record<string, unknown>[];
};

export const EXAMPLE_DATASETS: ExampleDataset[] = [
  { label: "Employees", data: employeesData },
  { label: "HTTP Logs", data: httpLogsData },
  { label: "Notes", data: notesData },
  { label: "Auction Bids", data: auctionBidsData },
  { label: "Orders", data: ordersData },
  { label: "Issues", data: issuesData },
  { label: "Movies", data: moviesData },
  { label: "Locations", data: locationsData },
];

export const PLACEHOLDER_DATA = EXAMPLE_DATASETS[0].data;
export const PLACEHOLDER_DATA_JSON = JSON.stringify(PLACEHOLDER_DATA, null, 2);

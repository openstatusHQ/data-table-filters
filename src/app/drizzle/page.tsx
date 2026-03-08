import { getQueryClient } from "@/providers/get-query-client";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Client } from "./client";

export default function Page() {
  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      <Client />
    </HydrationBoundary>
  );
}

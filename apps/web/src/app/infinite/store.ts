"use client";

import { createFilterSlice } from "@dtf/registry/lib/store/adapters/zustand";
import { create } from "zustand";
import { filterSchema } from "./schema";

export const useFilterStore = create<Record<string, unknown>>((set, get) => ({
  ...createFilterSlice(filterSchema.definition, "infinite", set, get),
}));

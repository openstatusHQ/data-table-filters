"use client";

import type { Table } from "@tanstack/react-table";
import type { DataTableInputFilterField } from "./types";
import { InputWithAddons } from "@/components/custom/input-with-addons";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";

type DataTableFilterInputProps<TData> = DataTableInputFilterField<TData> & {
  table: Table<TData>;
};

export function DataTableFilterInput<TData>({
  table,
  value: _value,
}: DataTableFilterInputProps<TData>) {
  const value = _value as string;
  const column = table.getColumn(value);
  const filterValue = column?.getFilterValue();
  const [input, setInput] = useState<string>(
    typeof filterValue === "string" ? filterValue : ""
  );

  const debouncedInput = useDebounce(input, 1000);

  useEffect(() => {
    const newValue = debouncedInput.trim() === "" ? null : debouncedInput;
    column?.setFilterValue(newValue);
  }, [debouncedInput]);

  useEffect(() => {
    if (debouncedInput.trim() !== filterValue) {
      const filters = typeof filterValue === "string" ? filterValue : "";
      setInput(filters);
    }
  }, [filterValue]);

  return (
    <div className="grid w-full gap-1.5">
      <Label htmlFor={value} className="sr-only px-2 text-muted-foreground">
        {value}
      </Label>
      <InputWithAddons
        placeholder="Search"
        leading={<Search className="mt-0.5 h-4 w-4" />}
        containerClassName="h-9 rounded-lg"
        name={value}
        id={value}
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
    </div>
  );
}

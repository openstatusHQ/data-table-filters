import { regions } from "@/constants/region";

interface DataTableColumnRegionProps {
  value: string;
  showFlag?: boolean;
  reverse?: boolean;
}

export function DataTableColumnRegion({
  value,
  showFlag = false,
  reverse = false,
}: DataTableColumnRegionProps) {
  const region = regions[value] ?? { label: value, flag: "" };
  return reverse ? (
    <>
      <span className="text-muted-foreground text-xs">
        {showFlag && region.flag} {region.label}
      </span>{" "}
      <span>{value}</span>
    </>
  ) : (
    <>
      <span>{value}</span>{" "}
      <span className="text-muted-foreground text-xs">
        {showFlag && region.flag} {region.label}
      </span>
    </>
  );
}

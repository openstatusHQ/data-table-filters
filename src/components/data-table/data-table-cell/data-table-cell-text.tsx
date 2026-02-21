import { TextWithTooltip } from "@/components/custom/text-with-tooltip";

export function DataTableCellText({ value }: { value: string | number }) {
  return <TextWithTooltip text={value} />;
}

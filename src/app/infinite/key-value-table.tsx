import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/custom/table";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { Check } from "lucide-react";
import { Copy } from "lucide-react";

interface KeyValueTableProps {
  data: Record<string, string>;
}
export function KeyValueTable({ data }: KeyValueTableProps) {
  return (
    <div className="mx-auto max-w-lg">
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <Table>
          <TableBody>
            {Object.entries(data).map(([key, value]) => {
              return <RowAction key={key} label={key} value={value} />;
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function RowAction({ label, value }: { label: string; value: string }) {
  const { copy, isCopied } = useCopyToClipboard();

  return (
    <TableRow
      className="group *:border-border hover:bg-transparent [&>:not(:last-child)]:border-r"
      onClick={(e) => {
        e.stopPropagation();
        copy(value);
      }}
    >
      <TableCell className="bg-muted/50 py-1 font-medium font-mono">
        {label}
      </TableCell>
      <TableCell className="relative py-1 font-mono">
        {value}
        <div className="absolute top-2 right-2 invisible group-hover:visible">
          {!isCopied ? (
            <Copy className="h-3 w-3" />
          ) : (
            <Check className="h-3 w-3" />
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

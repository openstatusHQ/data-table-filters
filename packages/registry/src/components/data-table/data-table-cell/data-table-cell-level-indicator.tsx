import { cn } from "@dtf/registry/lib/utils";

/**
 * Severity → the core block's semantic colour tokens (`--error`, `--warning`,
 * `--info`, `--success` in globals.css). The timeline chart reads the same
 * variables for its series, so a level's dot and its bar always match.
 */
const LEVEL_COLORS: Record<string, string> = {
  error: "bg-error",
  warn: "bg-warning",
  warning: "bg-warning",
  info: "bg-info",
  debug: "bg-muted-foreground",
  success: "bg-success",
};

/**
 * A colored square keyed by severity.
 *
 * The label is off by default: in a narrow table column the dot is the whole
 * message. The row sheet turns it on, where "info" next to the dot reads as
 * a value rather than noise.
 */
export function DataTableCellLevelIndicator({
  value,
  color: colorOverride,
  label = value,
  showLabel = false,
  dotPosition = "start",
  labelMinWidth,
}: {
  value: string;
  color?: string;
  /** Text shown next to the dot. Defaults to the raw value. */
  label?: string;
  showLabel?: boolean;
  /**
   * Which side of the label the dot sits on. The filter sidebar puts it at the
   * end: a mark right after the checkbox reads as a second checkbox.
   */
  dotPosition?: "start" | "end";
  /**
   * CSS min-width of the label, e.g. `"7ch"`. With the dot at the end, a list
   * of options passes the width of its longest label so the dots line up.
   */
  labelMinWidth?: string;
}) {
  const builtinColor = LEVEL_COLORS[value.toLowerCase()] ?? "bg-muted";
  const dot = (
    <span
      className={cn(
        "inline-block size-3 shrink-0 rounded-sm",
        !colorOverride && builtinColor,
      )}
      style={colorOverride ? { backgroundColor: colorOverride } : undefined}
    />
  );

  // Dot only: centred in the (narrow) cell, named for screen readers via
  // `aria-label` rather than an `sr-only` span — that span is absolutely
  // positioned and would escape the table's scroll container, stretching the
  // page by one row height per row.
  if (!showLabel) {
    return (
      <span className="flex items-center justify-center">
        <span role="img" aria-label={label}>
          {dot}
        </span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={colorOverride ? { color: colorOverride } : undefined}
    >
      {dotPosition === "start" ? dot : null}
      <span
        className="truncate font-normal"
        style={labelMinWidth ? { minWidth: labelMinWidth } : undefined}
      >
        {label}
      </span>
      {dotPosition === "end" ? dot : null}
    </span>
  );
}

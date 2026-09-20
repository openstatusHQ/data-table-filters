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
  alignLabels,
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
   * The labels of the sibling options. With the dot at the end, the label
   * takes the width of the widest of them so the dots line up. They are laid
   * out invisibly rather than counted in `ch`: only the browser knows how wide
   * "WARNING" or a CJK label is in the current font.
   */
  alignLabels?: string[];
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
      {alignLabels?.length ? (
        // Every label shares one grid cell, so the cell is as wide as the
        // widest. The sizers draw their text from an attribute: it stays out
        // of the DOM text, the clipboard and the accessibility tree.
        <span className="inline-grid font-normal">
          {alignLabels.map((sizer) => (
            <span
              key={sizer}
              aria-hidden
              data-label={sizer}
              className="invisible col-start-1 row-start-1 whitespace-nowrap before:content-[attr(data-label)]"
            />
          ))}
          <span className="col-start-1 row-start-1 truncate">{label}</span>
        </span>
      ) : (
        <span className="truncate font-normal">{label}</span>
      )}
      {dotPosition === "end" ? dot : null}
    </span>
  );
}

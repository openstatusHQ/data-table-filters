/**
 * Lightweight CSV parser (RFC 4180 compliant).
 * Converts CSV text into an array of objects keyed by the header row.
 * Handles quoted fields with commas, newlines, and escaped quotes.
 */

/** Convert a header string to kebab-case lowercase. */
function toKebabCase(str: string): string {
  return str
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1-$2") // camelCase → camel-Case
    .replace(/[\s_]+/g, "-") // spaces/underscores → hyphens
    .replace(/[^a-zA-Z0-9-]/g, "") // strip non-alphanumeric (keep hyphens)
    .replace(/-+/g, "-") // collapse multiple hyphens
    .replace(/^-|-$/g, "") // trim leading/trailing hyphens
    .toLowerCase();
}

function coerce(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "null") return null;
  if (trimmed.toLowerCase() === "true") return true;
  if (trimmed.toLowerCase() === "false") return false;
  const num = Number(trimmed);
  if (!Number.isNaN(num) && trimmed !== "") return num;
  return trimmed;
}

/**
 * Parse CSV text into rows of string arrays.
 * Iterates character-by-character to properly handle quoted fields
 * that contain commas, newlines, and escaped quotes.
 */
function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < len && text[i + 1] === '"') {
          // Escaped quote
          field += '"';
          i += 2;
        } else {
          // Closing quote
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        row.push(field);
        field = "";
        i++;
      } else if (ch === "\r") {
        // CRLF or bare CR — end of row
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
        i++;
        if (i < len && text[i] === "\n") i++;
      } else if (ch === "\n") {
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Final field/row
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export interface ParseCSVResult {
  /** Rows keyed by kebab-case header keys. */
  data: Record<string, unknown>[];
  /** Map from kebab-case key → original CSV heading. */
  headerMap: Record<string, string>;
}

export function parseCSV(text: string): ParseCSVResult {
  const allRows = parseRows(text);
  if (allRows.length < 2) return { data: [], headerMap: {} };

  const originalHeaders = allRows[0].map((h) => h.trim());
  const kebabHeaders = originalHeaders.map(toKebabCase);

  const headerMap: Record<string, string> = {};
  for (let j = 0; j < originalHeaders.length; j++) {
    headerMap[kebabHeaders[j]] = originalHeaders[j];
  }

  const data: Record<string, unknown>[] = [];

  for (let i = 1; i < allRows.length; i++) {
    const values = allRows[i];
    // Skip empty rows (single empty field)
    if (values.length === 1 && values[0].trim() === "") continue;
    const row: Record<string, unknown> = {};
    for (let j = 0; j < kebabHeaders.length; j++) {
      row[kebabHeaders[j]] = coerce(values[j] ?? "");
    }
    data.push(row);
  }

  return { data, headerMap };
}

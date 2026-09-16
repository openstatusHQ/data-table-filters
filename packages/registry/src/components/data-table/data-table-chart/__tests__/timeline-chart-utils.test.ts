import { describe, expect, it } from "vitest";
import type { Box } from "./timeline-chart-utils";
import {
  centerWithin,
  formatAxisTick,
  formatSelectionRange,
  getBucketInterval,
  getSelectionBounds,
  getSelectionCardLeft,
  getSelectionEdges,
  getSelectionLabels,
  getSelectionScrim,
  isPointerEvent,
  orderSelectionLabels,
  SELECTION_CARD_GAP,
  SELECTION_EDGE_WIDTH,
  SELECTION_GRIP_WIDTH,
  SELECTION_LABEL_GAP,
  SELECTION_LABEL_OFFSET,
  sumBucketRows,
  sumBucketValues,
} from "./timeline-chart-utils";

const buckets = [
  { timestamp: 1_000, success: 10, warning: 2, error: 1 },
  { timestamp: 2_000, success: 20, warning: 0, error: 0 },
  { timestamp: 3_000, success: 5, warning: 1, error: 4 },
];

describe("sumBucketRows", () => {
  it("returns 0 for empty data", () => {
    expect(sumBucketRows([], 0, 10_000)).toBe(0);
  });

  it("sums every numeric key but timestamp", () => {
    expect(sumBucketRows(buckets, 1_000, 1_000)).toBe(13);
  });

  it("includes both range bounds", () => {
    expect(sumBucketRows(buckets, 1_000, 3_000)).toBe(43);
  });

  it("excludes buckets outside the range", () => {
    expect(sumBucketRows(buckets, 2_000, 2_000)).toBe(20);
  });

  it("treats a reversed range the same as a forward one", () => {
    expect(sumBucketRows(buckets, 3_000, 1_000)).toBe(
      sumBucketRows(buckets, 1_000, 3_000),
    );
  });

  it("returns 0 when no bucket falls in the range", () => {
    expect(sumBucketRows(buckets, 10_000, 20_000)).toBe(0);
  });

  it("works with arbitrary bucket keys", () => {
    const custom = [{ timestamp: 1_000, foo: 3, bar: 4 }];
    expect(sumBucketRows(custom, 1_000, 1_000)).toBe(7);
  });

  it("ignores non-finite and non-numeric values", () => {
    const dirty = [
      { timestamp: 1_000, ok: 5, nan: NaN, inf: Infinity },
    ] as unknown as { timestamp: number; [key: string]: number }[];
    expect(sumBucketRows(dirty, 1_000, 1_000)).toBe(5);
  });
});

describe("sumBucketValues", () => {
  it("keeps each key separate", () => {
    expect(sumBucketValues(buckets, 1_000, 3_000)).toEqual({
      success: 35,
      warning: 3,
      error: 5,
    });
  });

  it("agrees with the total sumBucketRows reports", () => {
    const values = sumBucketValues(buckets, 1_000, 3_000);
    const total = Object.values(values).reduce((sum, v) => sum + v, 0);
    expect(total).toBe(sumBucketRows(buckets, 1_000, 3_000));
  });

  it("omits keys no bucket in range carries", () => {
    expect(sumBucketValues([{ timestamp: 0, foo: 2 }], 0, 0)).toEqual({
      foo: 2,
    });
  });

  it("returns an empty record when nothing is in range", () => {
    expect(sumBucketValues(buckets, 10_000, 20_000)).toEqual({});
  });
});

describe("getBucketInterval", () => {
  it("returns 0 for fewer than two buckets", () => {
    expect(getBucketInterval([])).toBe(0);
    expect(getBucketInterval([buckets[0]])).toBe(0);
  });

  it("derives the interval from the first two buckets", () => {
    expect(getBucketInterval(buckets)).toBe(1_000);
  });

  it("is direction agnostic", () => {
    const descending = [...buckets].reverse();
    expect(getBucketInterval(descending)).toBe(1_000);
  });
});

describe("getSelectionBounds", () => {
  const label = (ms: number) => new Date(ms).toString();

  it("returns null for unparseable labels", () => {
    expect(getSelectionBounds(buckets, "nope", label(1_000))).toBeNull();
    expect(getSelectionBounds(buckets, label(1_000), "nope")).toBeNull();
  });

  it("orders the bounds regardless of drag direction", () => {
    const forward = getSelectionBounds(buckets, label(0), label(60_000));
    const backward = getSelectionBounds(buckets, label(60_000), label(0));
    expect(forward).toEqual(backward);
    expect(forward?.from).toBe(0);
    expect(forward?.toBucket).toBe(60_000);
  });

  it("extends the end by one full bucket interval", () => {
    const data = [{ timestamp: 0 }, { timestamp: 60_000 }];
    const bounds = getSelectionBounds(data, label(0), label(60_000));
    expect(bounds?.displayEnd).toBe(120_000);
  });

  it("keeps filterEnd one ms short of the next bucket", () => {
    const data = [{ timestamp: 0 }, { timestamp: 60_000 }];
    const bounds = getSelectionBounds(data, label(0), label(60_000));
    // `inDateRange` compares with <=, so filterEnd must stop before the next
    // bucket's first instant or the filter includes a row the readout never
    // counted.
    expect(bounds?.filterEnd).toBe(119_999);
    expect(bounds?.filterEnd).toBe((bounds?.displayEnd ?? 0) - 1);
  });

  it("does not invert the range when the interval is unknown", () => {
    const single = [{ timestamp: 0 }];
    const bounds = getSelectionBounds(single, label(0), label(0));
    expect(bounds?.filterEnd).toBe(0);
    expect(bounds?.filterEnd).toBeGreaterThanOrEqual(bounds?.from ?? 0);
  });

  it("counts exactly the buckets the committed filter would match", () => {
    // The invariant the readout depends on: every bucket inside
    // [from, filterEnd] is counted, and the next one is not.
    const data = [
      { timestamp: 0, rows: 1 },
      { timestamp: 60_000, rows: 2 },
      { timestamp: 120_000, rows: 4 },
    ];
    const bounds = getSelectionBounds(data, label(0), label(60_000))!;

    const matched = data
      .filter(
        (b) => b.timestamp >= bounds.from && b.timestamp <= bounds.filterEnd,
      )
      .reduce((sum, b) => sum + b.rows, 0);

    expect(matched).toBe(sumBucketRows(data, bounds.from, bounds.toBucket));
    expect(matched).toBe(3); // the 120_000 bucket stays out
  });
});

describe("formatAxisTick", () => {
  // local-time constructor keeps the expectations timezone independent
  const at = (day: number, hour: number, minute = 0, second = 0) =>
    new Date(2026, 6, day, hour, minute, second).getTime();

  it("returns N/A for unparseable values", () => {
    expect(formatAxisTick("nope", "1d")).toBe("N/A");
  });

  it("gets coarser as the period widens", () => {
    const value = at(21, 16, 52, 30);
    expect(formatAxisTick(value, "10m")).toBe("16:52:30");
    expect(formatAxisTick(value, "1d")).toBe("16:52");
    expect(formatAxisTick(value, "1w")).toBe("Jul 21 16:52");
    expect(formatAxisTick(value, "1mo")).toBe("Jul 21, 2026");
  });

  it("falls back to the widest format without a period", () => {
    expect(formatAxisTick(at(21, 16), undefined)).toBe("Jul 21, 2026");
  });

  it("takes the same date as a string or a timestamp", () => {
    const value = at(21, 16, 52);
    expect(formatAxisTick(new Date(value).toString(), "1d")).toBe(
      formatAxisTick(value, "1d"),
    );
  });
});

describe("getSelectionLabels", () => {
  const selection = { x: 200, y: 0, width: 300, height: 40 };
  const widths = { start: 60, end: 60 };

  it("centers each label on its edge, below the plot", () => {
    const { start, end } = getSelectionLabels(selection, 1_000, widths);
    expect(start.x).toBe(200);
    expect(end?.x).toBe(500);
    expect(start.y).toBe(40 + SELECTION_LABEL_OFFSET);
    expect(end?.y).toBe(start.y);
  });

  it("drops the end label when the two would touch", () => {
    // 60 wide labels centered on either edge need more than 60 between them
    const narrow = { ...selection, width: 60 + SELECTION_LABEL_GAP - 1 };
    expect(getSelectionLabels(narrow, 1_000, widths).end).toBeNull();
  });

  it("keeps the end label at exactly the minimum gap", () => {
    const tight = { ...selection, width: 60 + SELECTION_LABEL_GAP };
    expect(getSelectionLabels(tight, 1_000, widths).end).not.toBeNull();
  });

  it("keeps both labels inside the plot", () => {
    const atEdges = { ...selection, x: 0, width: 1_000 };
    const { start, end } = getSelectionLabels(atEdges, 1_000, widths);
    expect(start.x).toBe(30); // half a label in, not hanging off the left
    expect(end?.x).toBe(970);
  });

  it("drops the end label when clamping closes the gap", () => {
    // the raw width says there is room, but both labels get pushed inwards by
    // the plot edges until they collide
    const narrowPlot = { ...selection, x: 0, width: 80 };
    expect(getSelectionLabels(narrowPlot, 80, widths).end).toBeNull();
  });
});

describe("isPointerEvent", () => {
  it("accepts a real mouse event", () => {
    expect(isPointerEvent({ type: "mousemove", pageX: 10, pageY: 20 })).toBe(
      true,
    );
  });

  it("rejects the a11y layer's spoofed move, which carries no type", () => {
    expect(isPointerEvent({ pageX: 10, pageY: 20 })).toBe(false);
  });

  it("rejects a missing event", () => {
    expect(isPointerEvent(undefined)).toBe(false);
    expect(isPointerEvent(null)).toBe(false);
  });
});

describe("orderSelectionLabels", () => {
  const label = (ms: number) => new Date(ms).toString();

  it("keeps a forward drag as is", () => {
    expect(orderSelectionLabels(label(1_000), label(3_000))).toEqual([
      label(1_000),
      label(3_000),
    ]);
  });

  it("flips a backwards drag", () => {
    expect(orderSelectionLabels(label(3_000), label(1_000))).toEqual([
      label(1_000),
      label(3_000),
    ]);
  });

  it("keeps a single-bucket selection", () => {
    expect(orderSelectionLabels(label(1_000), label(1_000))).toEqual([
      label(1_000),
      label(1_000),
    ]);
  });

  it("leaves unparseable labels in the order they came in", () => {
    expect(orderSelectionLabels("nope", label(1_000))).toEqual([
      "nope",
      label(1_000),
    ]);
    expect(orderSelectionLabels(label(1_000), "nope")).toEqual([
      label(1_000),
      "nope",
    ]);
  });
});

describe("formatSelectionRange", () => {
  // local-time constructors keep the expectations timezone independent
  const at = (day: number, hour: number, minute = 0, second = 0) =>
    new Date(2026, 6, day, hour, minute, second).getTime();

  it("leads with the date even when the range stays within one day", () => {
    expect(formatSelectionRange(at(21, 16, 52), at(21, 17, 2), "1d")).toEqual({
      start: "Jul 21 16:52",
      end: "17:02",
    });
  });

  it("repeats the date once the range crosses midnight", () => {
    expect(formatSelectionRange(at(21, 23, 50), at(22, 0, 10), "1d")).toEqual({
      start: "Jul 21 23:50",
      end: "Jul 22 00:10",
    });
  });

  it("adds seconds on the tightest period", () => {
    expect(
      formatSelectionRange(at(21, 16, 52, 5), at(21, 16, 54, 35), "10m"),
    ).toEqual({ start: "Jul 21 16:52:05", end: "16:54:35" });
  });

  it("keeps minute precision on the wider periods", () => {
    expect(formatSelectionRange(at(21, 16, 52), at(27, 0, 52), "1mo")).toEqual({
      start: "Jul 21 16:52",
      end: "Jul 27 00:52",
    });
  });

  it("falls back to minutes without a period", () => {
    expect(formatSelectionRange(at(21, 16, 52), at(21, 17, 2))).toEqual({
      start: "Jul 21 16:52",
      end: "17:02",
    });
  });
});

describe("centerWithin", () => {
  it("centers the element on the given point when there is room", () => {
    expect(centerWithin(300, 100, 600)).toBe(250);
  });

  it("hugs each edge of the plot instead of overflowing it", () => {
    expect(centerWithin(10, 100, 600)).toBe(0);
    expect(centerWithin(590, 100, 600)).toBe(500);
  });

  it("falls back to the element width when the chart isn't measured yet", () => {
    expect(centerWithin(300, 100, 0)).toBe(0);
  });

  it("stays at 0 for an element wider than the plot", () => {
    expect(centerWithin(300, 800, 600)).toBe(0);
  });

  it("returns the point itself before the element has been measured", () => {
    expect(centerWithin(300, 0, 600)).toBe(300);
  });
});

describe("getSelectionCardLeft", () => {
  const CARD = 200;
  const left = (
    selection: { x: number; width: number },
    chartWidth = 1_000,
    cardWidth = CARD,
  ) => getSelectionCardLeft(selection, cardWidth, chartWidth);

  it("centers on a selection wider than the card", () => {
    // the card can't swallow it - both ends stay visible around it
    expect(left({ x: 200, width: 400 })).toBe(300);
  });

  it("centers when the selection is exactly as wide as the card", () => {
    expect(left({ x: 200, width: CARD })).toBe(200);
  });

  it("steps aside for a narrow selection, to the roomier side", () => {
    // 400 to its left, 560 to its right
    expect(left({ x: 400, width: 40 })).toBe(440 + SELECTION_CARD_GAP);
  });

  it("goes left when that is the roomier side", () => {
    // 600 to its left, 360 to its right
    expect(left({ x: 600, width: 40 })).toBe(600 - SELECTION_CARD_GAP - CARD);
  });

  it("takes the tighter side when the roomier one can't fit the card", () => {
    // hard against the right edge: no room there, plenty on the left
    const x = 1_000 - 40;
    expect(left({ x, width: 40 })).toBe(x - SELECTION_CARD_GAP - CARD);
  });

  it("falls back to centered when neither side fits the card", () => {
    // a plot barely wider than the card itself: centered on the selection
    // (120) and still inside the plot
    expect(left({ x: 100, width: 40 }, 250)).toBe(20);
  });

  it("keeps the card inside the plot on either side", () => {
    expect(left({ x: 0, width: 40 })).toBeGreaterThanOrEqual(0);
    expect(left({ x: 960, width: 40 })).toBeGreaterThanOrEqual(0);
    expect(left({ x: 960, width: 40 })).toBeLessThanOrEqual(1_000 - CARD);
  });

  it("centers before the card has been measured", () => {
    // width 0 counts as "narrower than the selection" - nothing to step aside for
    expect(left({ x: 200, width: 400 }, 1_000, 0)).toBe(400);
  });
});

describe("getSelectionEdges", () => {
  const edges = (selection: Partial<Box> = {}, chartWidth = 600) =>
    getSelectionEdges(
      { x: 100, y: 0, width: 200, height: 60, ...selection },
      chartWidth,
    );

  it("centers a line and a grip on each end of the selection", () => {
    const [start, end] = edges();
    expect(start.line.x).toBe(100 - SELECTION_EDGE_WIDTH / 2);
    expect(start.grip.x).toBe(100 - SELECTION_GRIP_WIDTH / 2);
    expect(end.line.x).toBe(300 - SELECTION_EDGE_WIDTH / 2);
    expect(end.grip.x).toBe(300 - SELECTION_GRIP_WIDTH / 2);
  });

  it("keeps edges inside the plot on both boundaries", () => {
    const [start, end] = edges({ x: 0, width: 600 });
    expect(start.line.x).toBe(0);
    expect(start.grip.x).toBe(0);
    expect(end.line.x).toBe(600 - SELECTION_EDGE_WIDTH);
    expect(end.grip.x).toBe(600 - SELECTION_GRIP_WIDTH);
  });

  it("clamps against the element width when the chart isn't measured yet", () => {
    expect(edges({}, 0).every((edge) => edge.line.x === 0)).toBe(true);
  });

  it("centers the grip vertically", () => {
    const [{ grip }] = edges();
    expect(grip.y + grip.height / 2).toBeCloseTo(30);
  });

  it("caps the grip on tall charts and never exceeds the plot height", () => {
    expect(edges({ height: 400 })[0].grip.height).toBe(24);
    expect(edges({ height: 6 })[0].grip.height).toBe(6);
  });

  it("spans the full plot height with the line", () => {
    const [{ line }] = edges({ y: 4, height: 56 });
    expect(line.y).toBe(4);
    expect(line.height).toBe(56);
  });
});

describe("getSelectionScrim", () => {
  const scrim = (x: number, width: number) =>
    getSelectionScrim({ x, y: 2, width, height: 60 }, 600);

  it("covers both sides of the selection", () => {
    expect(scrim(100, 200)).toEqual([
      { x: 0, width: 100, y: 2, height: 60 },
      { x: 300, width: 300, y: 2, height: 60 },
    ]);
  });

  it("drops the empty side when the selection touches a boundary", () => {
    expect(scrim(0, 200)).toEqual([{ x: 200, width: 400, y: 2, height: 60 }]);
    expect(scrim(400, 200)).toEqual([{ x: 0, width: 400, y: 2, height: 60 }]);
  });

  it("returns nothing when the selection spans the whole plot", () => {
    expect(scrim(0, 600)).toEqual([]);
  });

  it("never emits negative widths past the plot", () => {
    expect(scrim(500, 200)).toEqual([{ x: 0, width: 500, y: 2, height: 60 }]);
  });
});

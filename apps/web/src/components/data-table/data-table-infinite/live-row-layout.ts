/**
 * Where the live indicator sits in a row of visible columns.
 *
 * The live row is not a data row: it is one indicator cell plus a label that
 * spans everything after it. Which cell holds the indicator depends on the
 * table, not on the row — a select column in front, a hidden column, or a
 * reordered level column all move it — so the layout is derived from the
 * visible column ids rather than assumed to be "first cell, then the rest".
 */
export type LiveRowLayout = {
  /** Visible column ids before the indicator column, one empty cell each. */
  leading: string[];
  /** The indicator column id, or `undefined` when it is not visible. */
  indicator: string | undefined;
  /** How many columns the label spans after the indicator. */
  span: number;
};

export function getLiveRowLayout(
  visibleColumnIds: readonly string[],
  indicatorColumnId: string,
): LiveRowLayout {
  const index = visibleColumnIds.indexOf(indicatorColumnId);
  if (index === -1) {
    // No indicator column on screen: the label takes the whole row.
    return { leading: [], indicator: undefined, span: visibleColumnIds.length };
  }
  return {
    leading: visibleColumnIds.slice(0, index),
    indicator: indicatorColumnId,
    span: visibleColumnIds.length - index - 1,
  };
}

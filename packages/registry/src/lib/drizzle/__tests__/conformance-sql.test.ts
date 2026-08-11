import { defineFilters } from "@dtf/registry/lib/filters";
import {
  conformanceRows,
  conformanceSchema,
  runConformance,
  type ConformanceCase,
} from "@dtf/registry/lib/filters/testing/conformance";
import { and, sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { buildWhereConditions } from "../filters";
import type { ColumnMapping } from "../types";
import { createPgliteDb, getCollation, type PgliteDb } from "./pglite";

/**
 * The conformance corpus, executed as real SQL.
 *
 * ## Why this is ungated
 *
 * The Drizzle suites in `apps/web` are `describe.skipIf(!hasDatabase)`, and the
 * pre-commit hook runs `DATABASE_URL= pnpm turbo test` — so the SQL engine was
 * *guaranteed* to be unexercised before every commit. The one engine whose
 * behaviour cannot be predicted by reading the TypeScript was the one never
 * run, which is how `[200, 500]` compiling to `BETWEEN 200 AND 500` reached
 * production.
 *
 * PGLite is Postgres compiled to WASM: `ilike`, `between`, `inArray`, `&&` and
 * `unnest` are the real implementations, not re-implementations. So this suite
 * needs no server and carries no skip guard. The node-postgres suites remain as
 * tier 2 against a real server in CI — PGLite is one build of Postgres with one
 * collation and cannot speak for every deployment.
 */

const conformance = pgTable("conformance", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  status: integer("status").notNull(),
  port: integer("port").notNull(),
  latency: integer("latency").notNull(),
  active: boolean("active").notNull(),
  // `text`, not a pg enum: the corpus expects `level: ["nope"]` to return no
  // rows, whereas a real enum column rejects the value at the protocol level.
  // That difference belongs to the column type the consumer chooses, not to the
  // filter engine — and `sql-injection.test.ts` already pins the enum behaviour.
  level: text("level").notNull(),
  regions: text("regions").array().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  headers: jsonb("headers").$type<Record<string, string>>().notNull(),
});

/** Corpus keys are flat, so this mapping is one-to-one by construction. */
const columnMapping: ColumnMapping = {
  name: conformance.name,
  status: conformance.status,
  port: conformance.port,
  latency: conformance.latency,
  active: conformance.active,
  level: conformance.level,
  regions: conformance.regions,
  createdAt: conformance.createdAt,
};

const filters = defineFilters(conformanceSchema);

let db: PgliteDb;

async function setup() {
  db = createPgliteDb();
  await db.execute(sql`
    CREATE TABLE conformance (
      id integer PRIMARY KEY,
      name text NOT NULL,
      status integer NOT NULL,
      port integer NOT NULL,
      latency integer NOT NULL,
      active boolean NOT NULL,
      level text NOT NULL,
      regions text[] NOT NULL,
      created_at timestamptz NOT NULL,
      headers jsonb NOT NULL
    )
  `);
  await db.insert(conformance).values(
    conformanceRows.map((row) => ({
      ...row,
      regions: [...row.regions],
    })),
  );
}

const ready = setup();

/**
 * Compile one case to SQL and run it.
 *
 * This is the whole point of the suite: the ids come back from Postgres
 * evaluating `buildWhereConditions`' output, not from any JavaScript predicate.
 */
async function select(testCase: ConformanceCase): Promise<number[]> {
  await ready;
  const conditions = buildWhereConditions(
    filters,
    { [testCase.key]: testCase.value },
    columnMapping,
  );
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db
    .select({ id: conformance.id })
    .from(conformance)
    .where(where);
  return rows.map((row) => row.id);
}

/**
 * PGLite declines nothing.
 *
 * Every corpus case — including the four tagged `ascii-ci` and the three tagged
 * `utc-ms` — is answered identically by Postgres and by the in-memory engine,
 * so declaring a divergence here would be dishonest in the *other* direction: it
 * would skip tests that pass, and hide a future regression behind a skip.
 *
 * Those tags are still correct as corpus metadata. They mark answers that depend
 * on ASCII case folding and on local-timezone day boundaries — substrate
 * assumptions a different engine may resolve differently. PGLite happens to
 * share them, and `divergence` below pins exactly why, and pins the inputs where
 * the two engines genuinely do part company.
 */
function supports(): boolean {
  return true;
}

runConformance({ engine: "drizzle + pglite", select, supports });

/**
 * Where `ilike` and `toLowerCase().includes()` genuinely disagree.
 *
 * The corpus does not contain these inputs — every string case in it is ASCII
 * and metacharacter-free, which is why nothing above is skipped. They are pinned
 * here instead, as a characterization test: the assertions record what each
 * engine does *today*, so a change on either side fails loudly rather than
 * silently shifting what a filter means.
 *
 * These are not bugs to fix. `substring` is a user-facing "contains" box; both
 * readings are defensible, and forcing them to agree would mean either escaping
 * LIKE metacharacters (a deliberate, separate decision — see
 * `sql-injection.test.ts`) or reimplementing Unicode case folding in SQL.
 */
describe("ilike vs toLowerCase().includes() — pinned divergences", () => {
  /**
   * Codepoint-explicit spellings.
   *
   * These pins turn on characters that are visually identical in a source file:
   * final sigma `ς` vs medial `σ`, and NFC `é` vs NFD `e` + combining acute. Any
   * editor or tool that normalizes the file would silently turn the assertion
   * into a tautology, so the distinguishing codepoints are written as escapes.
   */
  const SIGMA = "\u03c3"; // σ — medial/lowercase sigma
  const FINAL_SIGMA = "\u03c2"; // ς — word-final sigma
  /** "ΣΊΣΥΦΟΣ" — Sisyphus, uppercase. */
  const SISYPHUS_UPPER = "ΣΊΣΥΦΟΣ";
  /** "σίσυφος" — lowercased the way JS does it, with a final sigma. */
  const SISYPHUS_JS = `σίσυφο${FINAL_SIGMA}`;
  /** "σίσυφοσ" — lowercased the way C.UTF-8 `lower()` does it. */
  const SISYPHUS_PG = `σίσυφο${SIGMA}`;
  /** "café" with a precomposed é (NFC). */
  const CAFE_NFC = "caf\u00e9";
  /** "café" with e + combining acute accent (NFD). */
  const CAFE_NFD = "cafe\u0301";

  /** Ask both engines the same substring question about one cell. */
  async function ask(cell: string, needle: string) {
    await ready;
    await db.execute(sql`DELETE FROM conformance WHERE id = 999`);
    await db.execute(sql`
      INSERT INTO conformance VALUES (
        999, ${cell}, 0, 0, 0, true, 'info', ARRAY[]::text[], now(), '{}'::jsonb
      )
    `);
    const conditions = buildWhereConditions(
      filters,
      { name: needle },
      columnMapping,
    );
    const rows = await db
      .select({ id: conformance.id })
      .from(conformance)
      .where(and(...conditions));
    const pg = rows.some((row) => row.id === 999);
    await db.execute(sql`DELETE FROM conformance WHERE id = 999`);

    const js = cell.toLowerCase().includes(needle.toLowerCase());
    return { pg, js };
  }

  it("PGLite's collation is C — the fact these pins depend on", async () => {
    await ready;
    // `ILIKE` case-folds through `lower()`, which is LC_CTYPE-driven. A build
    // with an ICU or locale collation may fold more than this one does, so this
    // assertion is what makes the rest of the block reproducible.
    const { collate, ctype } = await getCollation(db);
    expect({ collate, ctype }).toEqual({ collate: "C", ctype: "C.UTF-8" });
  });

  describe("LIKE metacharacters — SQL treats them as wildcards, JS as literals", () => {
    // `toSQL` deliberately does not escape `%` and `_`; `sql-injection.test.ts`
    // pins that as safe-but-broadening. The consequence is that SQL is strictly
    // more permissive than the in-memory engine for these needles.
    it("`%` is a wildcard in SQL and a literal in JS", async () => {
      expect(await ask("abc", "a%c")).toEqual({ pg: true, js: false });
    });

    it("`_` is a single-character wildcard in SQL and a literal in JS", async () => {
      expect(await ask("abc", "a_c")).toEqual({ pg: true, js: false });
    });

    it("both agree when the metacharacter is really in the cell", async () => {
      expect(await ask("a_c", "a_c")).toEqual({ pg: true, js: true });
      expect(await ask("100%", "0%")).toEqual({ pg: true, js: true });
    });
  });

  describe("Unicode case folding — JS is context-aware, C.UTF-8 is not", () => {
    it("Greek final sigma: JS folds Σ→ς word-finally, Postgres always Σ→σ", async () => {
      // "ΣΊΣΥΦΟΣ".toLowerCase() is "σίσυφος" (final ς); lower() under C.UTF-8
      // yields "σίσυφοσ". This is the one case-folding difference the two
      // engines actually have — JS implements Unicode's context-sensitive
      // mapping, Postgres a per-character one.
      expect(await ask(SISYPHUS_UPPER, SISYPHUS_JS)).toEqual({
        pg: false,
        js: true,
      });
      // …and the mirror: Postgres matches the non-final spelling, JS does not.
      expect(await ask(SISYPHUS_UPPER, SISYPHUS_PG)).toEqual({
        pg: true,
        js: false,
      });
      // The two needles really are different strings — if a normalization step
      // ever collapsed them, both assertions above would still "pass" while
      // testing nothing.
      expect(SISYPHUS_JS).not.toBe(SISYPHUS_PG);
    });

    it("agrees on non-contextual folding across scripts", async () => {
      // Cyrillic, Latin-1 supplement and plain Greek all fold per-character, so
      // both engines agree. Pinned so a collation change shows up as a failure
      // here rather than as a behaviour change in the product.
      expect(await ask("ЖУРНАЛ", "журнал")).toEqual({ pg: true, js: true });
      expect(await ask("ÄRGER", "ärger")).toEqual({ pg: true, js: true });
      expect(await ask("ΑΒΓ", "αβγ")).toEqual({ pg: true, js: true });
    });

    it("agrees on the foldings neither engine performs", async () => {
      // Worth pinning because these are the ones most often assumed to work.
      // Turkish dotless ı: neither applies a Turkish locale.
      expect(await ask("ISTANBUL", "ıstanbul")).toEqual({
        pg: false,
        js: false,
      });
      // ß/SS: full case folding would match these; neither engine does it.
      expect(await ask("STRASSE", "straße")).toEqual({ pg: false, js: false });
      expect(await ask("Straße", "strasse")).toEqual({ pg: false, js: false });
      // Combining marks: NFD cell vs NFC needle. Neither engine normalizes.
      expect(await ask(CAFE_NFD, CAFE_NFC)).toEqual({ pg: false, js: false });
      expect(CAFE_NFD).not.toBe(CAFE_NFC);
      // Same spelling on both sides matches, so the miss above is about
      // normalization and not about the string being unmatchable.
      expect(await ask(CAFE_NFD, CAFE_NFD)).toEqual({ pg: true, js: true });
      expect(await ask(CAFE_NFC, CAFE_NFC)).toEqual({ pg: true, js: true });
    });
  });
});

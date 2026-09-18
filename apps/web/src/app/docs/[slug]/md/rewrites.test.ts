import { describe, expect, it } from "vitest";
import nextConfig from "../../../../../next.config.mjs";

type Rewrite = {
  source: string;
  destination: string;
  has?: { type: string; key: string; value?: string }[];
};

async function acceptRewrite() {
  const rewrites = ((await nextConfig.rewrites?.()) ?? []) as Rewrite[];
  const rule = rewrites.find(
    (r) => r.source === "/docs/:slug" && r.destination === "/docs/:slug/md",
  );
  const header = rule?.has?.find(
    (h) => h.type === "header" && h.key === "accept",
  );
  if (!header?.value) throw new Error("accept rewrite not found");
  // Next.js matches `has` values as ^value$.
  return new RegExp(`^${header.value}$`);
}

describe("markdown rewrite on the accept header", () => {
  it("matches agents asking for markdown", async () => {
    const matcher = await acceptRewrite();

    expect(matcher.test("text/markdown")).toBe(true);
    expect(matcher.test("text/markdown, text/html;q=0.9, */*;q=0.1")).toBe(
      true,
    );
    expect(matcher.test("text/html, text/markdown")).toBe(true);
  });

  it("leaves browsers on the html page", async () => {
    const matcher = await acceptRewrite();

    expect(
      matcher.test(
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ),
    ).toBe(false);
    expect(matcher.test("*/*")).toBe(false);
  });
});

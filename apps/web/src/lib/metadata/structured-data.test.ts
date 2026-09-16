import { CREATE_PROJECT_COMMAND } from "@/lib/llms/blocks";
import { describe, expect, it } from "vitest";
import { BASE_URL } from "./shared-metadata";
import {
  CREATE_PROJECT_STEPS,
  createJsonLDGraph,
  getJsonLDCreateProjectHowTo,
  getJsonLDHomepageFAQ,
  getJsonLDSoftwareApplication,
  HOMEPAGE_FAQS,
} from "./structured-data";

// The "start from scratch" command is the fastest first run there is, and the
// structured data is how a search engine or an agent that never renders the
// page gets it. These pin the command into that data verbatim, so a change to
// the command in blocks.ts cannot leave the JSON-LD describing an older one.

describe("the create-project HowTo", () => {
  const howTo = getJsonLDCreateProjectHowTo();

  it("carries the command verbatim in its first step", () => {
    const steps = howTo.step as unknown as { text: string; position: number }[];
    expect(steps[0].text).toContain(CREATE_PROJECT_COMMAND);
  });

  it("numbers the steps in order and points each at the Quick Start", () => {
    const steps = howTo.step as unknown as { position: number; url: string }[];
    expect(steps.map((step) => step.position)).toEqual(
      CREATE_PROJECT_STEPS.map((_, index) => index + 1),
    );
    for (const step of steps) {
      expect(step.url).toBe(`${BASE_URL}/docs/quick-start#start-from-scratch`);
    }
  });

  it("names the CLI as the tool and ends on the example route", () => {
    expect(JSON.stringify(howTo.tool)).toContain("shadcn");
    const steps = howTo.step as unknown as { text: string }[];
    expect(steps[steps.length - 1].text).toContain("localhost:3000/example");
  });
});

describe("the software application", () => {
  const app = getJsonLDSoftwareApplication();

  it("says where to install it from and what it needs", () => {
    expect(app.installUrl).toBe(`${BASE_URL}/docs/quick-start`);
    expect(String(app.softwareRequirements)).toContain("shadcn");
    expect(String(app.softwareRequirements)).toContain("Base UI");
  });
});

describe("the homepage FAQ", () => {
  it("answers the from-scratch question with the command, first", () => {
    expect(HOMEPAGE_FAQS[0].question).toMatch(/from scratch/i);
    expect(HOMEPAGE_FAQS[0].answer).toContain(CREATE_PROJECT_COMMAND);

    const page = getJsonLDHomepageFAQ();
    const first = (
      page.mainEntity as unknown as { acceptedAnswer: { text: string } }[]
    )[0];
    expect(first.acceptedAnswer.text).toContain(CREATE_PROJECT_COMMAND);
  });
});

describe("the graph", () => {
  it("keeps one @context and drops the per-item ones", () => {
    const graph = createJsonLDGraph([
      getJsonLDSoftwareApplication(),
      getJsonLDCreateProjectHowTo(),
      null,
    ]);
    expect(graph["@context"]).toBe("https://schema.org");
    expect(graph["@graph"]).toHaveLength(2);
    for (const item of graph["@graph"]) {
      expect(item).not.toHaveProperty("@context");
    }
    expect(graph["@graph"].map((item) => item["@type"])).toEqual([
      "SoftwareApplication",
      "HowTo",
    ]);
  });
});

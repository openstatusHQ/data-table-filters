import { describe, expect, it } from "vitest";
import { parseCSV } from "./csv-parser";

describe("parseCSV", () => {
  // -- basic parsing --

  it("parses simple CSV with header row", () => {
    const csv = "name,age\nAlice,30\nBob,25";
    const { data } = parseCSV(csv);
    expect(data).toEqual([
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ]);
  });

  it("returns empty data for header-only CSV", () => {
    const { data } = parseCSV("name,age");
    expect(data).toEqual([]);
  });

  it("returns empty for empty string", () => {
    const { data, headerMap } = parseCSV("");
    expect(data).toEqual([]);
    expect(headerMap).toEqual({});
  });

  it("returns empty for single line (just header, no data)", () => {
    const { data } = parseCSV("a,b,c\n");
    expect(data).toEqual([]);
  });

  // -- header transformation --

  it("converts camelCase headers to kebab-case", () => {
    const csv = "firstName,lastName\nAlice,Smith";
    const { data, headerMap } = parseCSV(csv);
    expect(data[0]).toHaveProperty("first-name");
    expect(headerMap["first-name"]).toBe("firstName");
  });

  it("converts snake_case headers to kebab-case", () => {
    const csv = "user_name,user_age\nAlice,30";
    const { data } = parseCSV(csv);
    expect(data[0]).toHaveProperty("user-name");
  });

  it("converts headers with spaces to kebab-case", () => {
    const csv = "First Name,Last Name\nAlice,Smith";
    const { data } = parseCSV(csv);
    expect(data[0]).toHaveProperty("first-name");
  });

  it("strips special characters from headers", () => {
    const csv = "Name (Full),Age!\nAlice,30";
    const { data } = parseCSV(csv);
    expect(data[0]).toHaveProperty("name-full");
  });

  it("provides headerMap from kebab-case to original", () => {
    const csv = "User Name,userAge\nAlice,30";
    const { headerMap } = parseCSV(csv);
    expect(headerMap["user-name"]).toBe("User Name");
    expect(headerMap["user-age"]).toBe("userAge");
  });

  // -- type coercion --

  it("coerces numbers", () => {
    const csv = "val\n42\n3.14\n-10";
    const { data } = parseCSV(csv);
    expect(data[0].val).toBe(42);
    expect(data[1].val).toBe(3.14);
    expect(data[2].val).toBe(-10);
  });

  it("coerces booleans", () => {
    const csv = "active\ntrue\nfalse\nTRUE\nFALSE";
    const { data } = parseCSV(csv);
    expect(data[0].active).toBe(true);
    expect(data[1].active).toBe(false);
    expect(data[2].active).toBe(true);
    expect(data[3].active).toBe(false);
  });

  it("coerces null values", () => {
    const csv = "val\nnull\nNULL\n";
    const { data } = parseCSV(csv);
    expect(data[0].val).toBeNull();
    expect(data[1].val).toBeNull();
  });

  it("keeps strings that are not numbers or booleans", () => {
    const csv = "name\nAlice\nhello world";
    const { data } = parseCSV(csv);
    expect(data[0].name).toBe("Alice");
    expect(data[1].name).toBe("hello world");
  });

  // -- RFC 4180 compliance --

  it("handles quoted fields with commas", () => {
    const csv = 'name,address\nAlice,"123 Main St, Apt 4"';
    const { data } = parseCSV(csv);
    expect(data[0].address).toBe("123 Main St, Apt 4");
  });

  it("handles quoted fields with newlines", () => {
    const csv = 'name,bio\nAlice,"Line 1\nLine 2"';
    const { data } = parseCSV(csv);
    expect(data[0].bio).toBe("Line 1\nLine 2");
  });

  it("handles escaped quotes (double-quote)", () => {
    const csv = 'name,quote\nAlice,"She said ""hello"""';
    const { data } = parseCSV(csv);
    expect(data[0].quote).toBe('She said "hello"');
  });

  it("handles CRLF line endings", () => {
    const csv = "name,age\r\nAlice,30\r\nBob,25";
    const { data } = parseCSV(csv);
    expect(data).toHaveLength(2);
  });

  it("handles bare CR line endings", () => {
    const csv = "name,age\rAlice,30\rBob,25";
    const { data } = parseCSV(csv);
    expect(data).toHaveLength(2);
  });

  // -- edge cases --

  it("skips empty rows", () => {
    const csv = "name,age\nAlice,30\n\nBob,25";
    const { data } = parseCSV(csv);
    expect(data).toHaveLength(2);
  });

  it("handles missing values (shorter rows)", () => {
    const csv = "a,b,c\n1,2";
    const { data } = parseCSV(csv);
    expect(data[0].c).toBeNull(); // coerce("") → null
  });

  it("handles trailing newline", () => {
    const csv = "name\nAlice\nBob\n";
    const { data } = parseCSV(csv);
    expect(data).toHaveLength(2);
  });
});

import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";

describe("parseCsv", () => {
  it("reads quoted fields with commas, doubled quotes and line breaks", () => {
    expect(parseCsv('a,b\r\n"1,5","say ""hi""\nthere"\n')).toEqual([["a", "b"], ["1,5", 'say "hi"\nthere']]);
  });
  it("drops the Excel BOM and blank lines, keeps empty cells", () => {
    expect(parseCsv("﻿slug,name\n\nx,\n")).toEqual([["slug", "name"], ["x", ""]]);
  });
  it("handles a last line without a newline", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("rejects an unterminated quote", () => {
    expect(() => parseCsv('a\n"oops')).toThrow("UNTERMINATED_QUOTE");
  });
});

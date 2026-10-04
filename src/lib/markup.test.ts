import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { markupToPlainText, parseMarkup, renderMarkup } from "./markup";

const html = (input: string) => renderToStaticMarkup(createElement("p", null, renderMarkup(input, { strike: "s", bold: "b" })));

describe("parseMarkup", () => {
  it("returns plain text untouched", () => {
    expect(parseMarkup("Stop paying every week!")).toEqual([{ kind: "text", text: "Stop paying every week!" }]);
  });

  it("parses strikethrough and bold", () => {
    expect(parseMarkup("Stop Paying Car Wash ~~₦4,000~~ Every Week with the **Turbo Vacuum**.")).toEqual([
      { kind: "text", text: "Stop Paying Car Wash " },
      { kind: "strike", text: "₦4,000" },
      { kind: "text", text: " Every Week with the " },
      { kind: "bold", text: "Turbo Vacuum" },
      { kind: "text", text: "." },
    ]);
  });

  it("handles markers at the start and end and several in a row", () => {
    expect(parseMarkup("**A**~~B~~")).toEqual([
      { kind: "bold", text: "A" },
      { kind: "strike", text: "B" },
    ]);
  });

  it("keeps unclosed or empty markers literal", () => {
    expect(parseMarkup("Save ~~₦4,000 today")).toEqual([{ kind: "text", text: "Save ~~₦4,000 today" }]);
    expect(parseMarkup("a ** ** b")).toEqual([{ kind: "text", text: "a ** ** b" }]);
    expect(parseMarkup("2 * 3 = 6")).toEqual([{ kind: "text", text: "2 * 3 = 6" }]);
  });

  it("does not nest markers (inner markers stay literal)", () => {
    expect(parseMarkup("**big ~~deal~~**")).toEqual([{ kind: "bold", text: "big ~~deal~~" }]);
  });

  it("handles null/empty", () => {
    expect(parseMarkup(null)).toEqual([]);
    expect(parseMarkup("")).toEqual([]);
  });
});

describe("renderMarkup", () => {
  it("renders <s> and <strong> with classes", () => {
    expect(html("Pay ~~₦4,000~~ for **this**")).toBe('<p>Pay <s class="s">₦4,000</s> for <strong class="b">this</strong></p>');
  });

  it("escapes HTML — admin text can never inject markup", () => {
    const out = html('<img src=x onerror="alert(1)"> **<script>alert(1)</script>**');
    expect(out).not.toContain("<img");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;img");
    expect(out).toContain('<strong class="b">&lt;script&gt;alert(1)&lt;/script&gt;</strong>');
  });

  it("keeps emojis, quotes and ampersands as text", () => {
    expect(html(`⚡ "His & Hers" **2x**`)).toBe('<p>⚡ &quot;His &amp; Hers&quot; <strong class="b">2x</strong></p>');
  });
});

describe("markupToPlainText", () => {
  it("strips markers", () => {
    expect(markupToPlainText("Stop Paying Car Wash ~~₦4,000~~ Every **Week**!")).toBe("Stop Paying Car Wash ₦4,000 Every Week!");
  });
});

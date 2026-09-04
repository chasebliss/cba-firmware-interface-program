// Tests for the inline markdown renderer. It has no DOM dependency worth
// pulling react-dom in for, so these exercise the element tree React returns
// rather than rendering to a document.

import { describe, expect, test } from "vitest";
import type { ReactElement } from "react";
import { InlineMarkdown } from "./InlineMarkdown";

// The component returns a fragment whose children are strings and elements.
const parse = (text: string) => {
  const out = InlineMarkdown({ text }) as ReactElement<{
    children: Array<string | ReactElement>;
  }>;
  const kids = out.props.children;
  return Array.isArray(kids) ? kids : [kids];
};

const shape = (text: string) =>
  parse(text).map((node) =>
    typeof node === "string"
      ? node
      : `<${String((node as ReactElement).type)}>`,
  );

const elements = (text: string) =>
  parse(text).filter((n) => typeof n !== "string") as ReactElement<{
    children: string;
    href?: string;
  }>[];

describe("InlineMarkdown", () => {
  test("plain text passes through untouched", () => {
    expect(shape("Bypass mute time much quicker")).toEqual([
      "Bypass mute time much quicker",
    ]);
  });

  test("bold, italic and code become elements", () => {
    expect(shape("**b** and *i* and `c`")).toEqual([
      "<strong>",
      " and ",
      "<em>",
      " and ",
      "<code>",
    ]);
    expect(elements("**b** and *i* and `c`").map((e) => e.props.children)).toEqual(
      ["b", "i", "c"],
    );
  });

  test("bold wins over italic on the same run", () => {
    const [el] = elements("**not italic**");
    expect(String(el.type)).toBe("strong");
    expect(el.props.children).toBe("not italic");
  });

  test("http links become anchors carrying their href", () => {
    const [el] = elements("See [the manual](https://chasebliss.com/manual)");
    expect(String(el.type)).toBe("a");
    expect(el.props.href).toBe("https://chasebliss.com/manual");
    expect(el.props.children).toBe("the manual");
  });

  test("a javascript: URL is not turned into a link", () => {
    // Notes come from a manifest in a repo, but a link is the one mark that
    // could carry a script, so only http(s) is accepted.
    const text = "[click](javascript:alert(1))";
    expect(elements(text)).toHaveLength(0);
    expect(parse(text).join("")).toBe(text);
  });

  test("unmatched marks render as literal characters", () => {
    // Notes written before markdown existed may contain a stray asterisk.
    expect(elements("2 * 3 = 6")).toHaveLength(0);
    expect(parse("*Steps 2 & 3 must be done in this order.").join("")).toBe(
      "*Steps 2 & 3 must be done in this order.",
    );
  });

  test("real requirement text with no marks is unchanged", () => {
    const line =
      "Repeated CC28 messages no longer occasionally turn off display";
    expect(parse(line)).toEqual([line]);
  });
});

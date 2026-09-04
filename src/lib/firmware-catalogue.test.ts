// Tests for the catalogue module's pure core: the manifest rules that used
// to exist as inline copies (the "./" filename strip, the name comparator,
// pedal grouping) plus the admin mapper that applies the same defaults the
// public loader does.

import { describe, expect, test } from "vitest";
import { GOLD, adminCatalogueFrom } from "./admin-firmware";
import {
  byName,
  filenameOf,
  noteBlocks,
  pedalsIn,
  versionsOf,
} from "./firmware-catalogue";

describe("filenameOf", () => {
  test("strips the manifest's leading ./", () => {
    expect(filenameOf("./MOOD_MKII_1.1.bin")).toBe("MOOD_MKII_1.1.bin");
  });

  test("leaves a bare basename alone", () => {
    expect(filenameOf("fw.hex")).toBe("fw.hex");
  });
});

describe("byName", () => {
  test("orders case-insensitively", () => {
    expect(byName({ name: "alpha" }, { name: "BETA" })).toBeLessThan(0);
    expect(byName({ name: "Zeta" }, { name: "alpha" })).toBeGreaterThan(0);
  });

  test("returns 0 on equal names so the sort is stable", () => {
    // The inline copies this replaced returned 1 here, letting equal-named
    // rows swap order between loads.
    expect(byName({ name: "MOOD" }, { name: "mood" })).toBe(0);
  });
});

describe("noteBlocks", () => {
  test("a dash starts a bullet, an indented dash nests", () => {
    expect(noteBlocks("- foo\n  * bar\n+ baz")).toEqual([
      { kind: "li", text: "foo", depth: 0 },
      { kind: "li", text: "bar", depth: 1 },
      { kind: "li", text: "baz", depth: 0 },
    ]);
  });

  test("plain lines are prose: consecutive lines join, a blank line splits", () => {
    expect(noteBlocks("Initial production\nrelease.\n\nMore later.")).toEqual([
      { kind: "p", text: "Initial production release." },
      { kind: "p", text: "More later." },
    ]);
  });

  test("bullets and paragraphs mix", () => {
    expect(noteBlocks("Fixes:\n- a\n- b\n\nThanks all.")).toEqual([
      { kind: "p", text: "Fixes:" },
      { kind: "li", text: "a", depth: 0 },
      { kind: "li", text: "b", depth: 0 },
      { kind: "p", text: "Thanks all." },
    ]);
  });

  test("an indented plain line continues the bullet above it", () => {
    expect(noteBlocks("- a long change\n  that wraps\nnot indented")).toEqual([
      { kind: "li", text: "a long change that wraps", depth: 0 },
      { kind: "p", text: "not indented" },
    ]);
  });

  test("a tab counts as an indent", () => {
    expect(noteBlocks("- a\n\t- b")[1]).toEqual({ kind: "li", text: "b", depth: 1 });
  });

  test("a single-space indent is a stray space, not nesting", () => {
    expect(noteBlocks("- a\n - b")[1]).toEqual({ kind: "li", text: "b", depth: 0 });
  });

  test("empty and undefined give no blocks", () => {
    expect(noteBlocks("")).toEqual([]);
    expect(noteBlocks(undefined)).toEqual([]);
    expect(noteBlocks("   \n  ")).toEqual([]);
  });
});

describe("pedalsIn", () => {
  test("dedupes, trims, drops empties, sorts", () => {
    const pedals = pedalsIn([
      { pedal: "MOOD MKII " },
      { pedal: "BIGTIME" },
      { pedal: "" },
      { pedal: "MOOD MKII" },
    ]);
    expect(pedals).toEqual(["BIGTIME", "MOOD MKII"]);
  });
});

describe("versionsOf", () => {
  const v = (pedal: string, uploadedAt: string | null) => ({
    pedal,
    uploadedAt,
  });

  test("filters to one pedal, newest release first", () => {
    const all = [
      v("BIGTIME", "2026-08-01T00:00:00Z"),
      v("MOOD MKII", "2026-04-23T23:00:00Z"),
      v("BIGTIME", "2026-08-12T00:00:00Z"),
    ];
    expect(versionsOf(all, "BIGTIME").map((e) => e.uploadedAt)).toEqual([
      "2026-08-12T00:00:00Z",
      "2026-08-01T00:00:00Z",
    ]);
  });

  test("entries with no date sink to the bottom", () => {
    const all = [v("BIGTIME", null), v("BIGTIME", "2026-08-01T00:00:00Z")];
    expect(versionsOf(all, "BIGTIME").map((e) => e.uploadedAt)).toEqual([
      "2026-08-01T00:00:00Z",
      null,
    ]);
  });
});

describe("adminCatalogueFrom", () => {
  test("maps entries with the shared defaults and strips ./ filenames", () => {
    const [fw] = adminCatalogueFrom({
      nightly: [{ name: "BIGTIME 1.0.2", filepath: "./BIGTIME_1.0.2.hex" }],
    });
    expect(fw).toEqual({
      name: "BIGTIME 1.0.2",
      pedal: "",
      filename: "BIGTIME_1.0.2.hex",
      target: "nightly",
      bgColor: GOLD,
      description: "",
      internalNotes: "",
      uploadedAt: null,
      updatedAt: null,
      active: true,
    });
  });

  test("entries predating the active field count as listed", () => {
    const [fw] = adminCatalogueFrom({
      beta: [{ name: "FW", filepath: "./fw.bin" }],
    });
    expect(fw.active).toBe(true);
    const [unlisted] = adminCatalogueFrom({
      beta: [{ name: "FW", filepath: "./fw.bin", active: false }],
    });
    expect(unlisted.active).toBe(false);
  });

  test("flattens all channels and sorts by name", () => {
    const merged = adminCatalogueFrom({
      production: [{ name: "zeta", filepath: "./z.bin" }],
      nightly: [{ name: "Alpha", filepath: "./a.bin" }],
    });
    expect(merged.map((e) => e.name)).toEqual(["Alpha", "zeta"]);
  });
});
